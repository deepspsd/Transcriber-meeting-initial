"""Minutes of Meeting (MoM) router — generate, fetch, update, and export MoMs."""
import os
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from bson import ObjectId

from database import get_db
from routers.auth import get_current_user
from services.llm import generate_mom
from config import settings
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mom", tags=["mom"])

class ActionItem(BaseModel):
    task: str
    owner: str
    deadline: str

class MoMData(BaseModel):
    title: str
    date: str
    duration: float
    participants: List[str]
    agenda_items: List[str]
    discussion_summary: str
    decisions: List[str]
    action_items: List[ActionItem]
    risks_concerns: List[str]
    next_steps: List[str]
    next_meeting_date: Optional[str]

@router.get("/{recording_id}")
async def get_mom(recording_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()

    mom = await db.minutes_of_meeting.find_one({"recording_id": recording_id, "user_id": user_id})
    if not mom:
        raise HTTPException(status_code=404, detail="MoM not found")

    # Serialize and strip the heavy versions array
    mom["_id"] = str(mom["_id"])
    mom.pop("versions", None)
    return mom


@router.post("/{recording_id}/generate")
async def generate_mom_endpoint(recording_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()
    
    # 1. Get transcript
    try:
        rec = await db.recordings.find_one(
            {"_id": ObjectId(recording_id), "user_id": user_id},
            {"transcript": 1, "filename": 1, "created_at": 1, "duration": 1, "speakers_detected": 1}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Recording ID")
        
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    if not rec.get("transcript"):
        raise HTTPException(status_code=400, detail="No transcript available to summarize")

    # 2. Call LLM
    meta = {
        "filename": rec.get("filename", "Meeting Notes"),
        "created_at": rec["created_at"].isoformat() if rec.get("created_at") else "",
        "duration": rec.get("duration", 0),
        "speakers_detected": rec.get("speakers_detected", [])
    }
    mom_data = generate_mom(rec["transcript"], meta)

    # 3. Save to DB
    now = datetime.utcnow()
    mom_doc = {
        "recording_id": recording_id,
        "user_id": user_id,
        "title": mom_data.get("title", ""),
        "date": mom_data.get("date", ""),
        "duration": mom_data.get("duration", 0),
        "participants": mom_data.get("participants", []),
        "agenda_items": mom_data.get("agenda_items", []),
        "discussion_summary": mom_data.get("discussion_summary", ""),
        "decisions": mom_data.get("decisions", []),
        "action_items": mom_data.get("action_items", []),
        "risks_concerns": mom_data.get("risks_concerns", []),
        "next_steps": mom_data.get("next_steps", []),
        "next_meeting_date": mom_data.get("next_meeting_date", ""),
        "created_at": now,
        "updated_at": now,
        "is_draft": False,
        "versions": [{
            "version": 1,
            "data": mom_data,
            "saved_at": now
        }]
    }

    # Upsert to overwrite if regenerating
    await db.minutes_of_meeting.update_one(
        {"recording_id": recording_id, "user_id": user_id},
        {"$set": mom_doc},
        upsert=True
    )
    
    saved_mom = await db.minutes_of_meeting.find_one({"recording_id": recording_id, "user_id": user_id})
    saved_mom["_id"] = str(saved_mom["_id"])
    saved_mom.pop("versions", None)
    
    return saved_mom

@router.patch("/{recording_id}")
async def update_mom(recording_id: str, data: MoMData, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()
    
    mom = await db.minutes_of_meeting.find_one({"recording_id": recording_id, "user_id": user_id})
    if not mom:
        raise HTTPException(status_code=404, detail="MoM not found")
        
    now = datetime.utcnow()
    update_data = data.dict()
    update_data["updated_at"] = now
    update_data["is_draft"] = True
    
    # Save current state as new version if we want (e.g., every 5 minutes or explicitly). 
    # For now, just save a version every time we patch if enough time has passed to prevent bloat.
    # We will keep it simple and just update the main fields, and maybe push a version if the user manually saves.
    # But since it's auto-save, we can just push a version if the last version is older than 5 minutes.
    
    last_version = mom.get("versions", [])[-1] if mom.get("versions") else None
    push_version = False
    if last_version:
        last_saved = last_version.get("saved_at")
        if last_saved and (now - last_saved).total_seconds() > 300: # 5 minutes
            push_version = True
            
    update_op = {"$set": update_data}
    if push_version:
        new_version_num = len(mom.get("versions", [])) + 1
        update_op["$push"] = {
            "versions": {
                "version": new_version_num,
                "data": update_data,
                "saved_at": now
            }
        }

    await db.minutes_of_meeting.update_one(
        {"_id": mom["_id"]},
        update_op
    )
    
    return {"status": "success", "updated_at": now.isoformat()}

@router.get("/{recording_id}/versions")
async def get_mom_versions(recording_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()
    
    mom = await db.minutes_of_meeting.find_one({"recording_id": recording_id, "user_id": user_id}, {"versions": 1})
    if not mom:
        raise HTTPException(status_code=404, detail="MoM not found")
        
    return {"versions": mom.get("versions", [])}

@router.post("/{recording_id}/pdf")
async def export_mom_pdf(recording_id: str, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])
    db = get_db()
    
    mom = await db.minutes_of_meeting.find_one({"recording_id": recording_id, "user_id": user_id})
    if not mom:
        raise HTTPException(status_code=404, detail="MoM not found")

    pdf_filename = f"mom_{recording_id}.pdf"
    pdf_path = os.path.join(settings.UPLOAD_DIR, pdf_filename)

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=50, leftMargin=50,
        topMargin=50, bottomMargin=50
    )

    styles = getSampleStyleSheet()
    
    # Matching existing PDF design (Dark navy blue theme)
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=12,
        fontName="Helvetica-Bold"
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=16,
        spaceAfter=8,
        fontName="Helvetica-Bold",
        borderPadding=(0, 0, 4, 0),
        borderColor=colors.HexColor("#e2e8f0"),
        borderWidth=1,
        borderRadius=0
    )
    
    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6,
        fontName="Helvetica",
        leading=14
    )
    
    meta_style = ParagraphStyle(
        'MetaStyle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=4,
        fontName="Helvetica-Oblique"
    )

    story = []

    # HEADER
    story.append(Paragraph(mom.get("title", "Minutes of Meeting"), title_style))
    story.append(Paragraph(f"Date: {mom.get('date', 'Unknown')}", meta_style))
    story.append(Paragraph(f"Duration: {mom.get('duration', 0)} seconds", meta_style))
    story.append(Spacer(1, 20))

    def _add_section(title, content_items, is_list=False):
        if not content_items:
            return
        story.append(Paragraph(title.upper(), header_style))
        if is_list:
            items = []
            for item in content_items:
                items.append(ListItem(Paragraph(str(item), normal_style)))
            story.append(ListFlowable(items, bulletType='bullet', start='bulletchar', bulletColor=colors.HexColor("#3b82f6")))
        else:
            story.append(Paragraph(str(content_items), normal_style))
        story.append(Spacer(1, 10))

    _add_section("Participants", mom.get("participants"), True)
    _add_section("Agenda Items", mom.get("agenda_items"), True)
    _add_section("Discussion Summary", mom.get("discussion_summary"), False)
    _add_section("Decisions Taken", mom.get("decisions"), True)
    
    # Action Items (formatted as list)
    if mom.get("action_items"):
        story.append(Paragraph("ACTION ITEMS", header_style))
        items = []
        for ai in mom["action_items"]:
            t = ai.get('task', '')
            o = ai.get('owner', 'Unassigned')
            d = ai.get('deadline', 'No deadline')
            text = f"<b>{t}</b> (Owner: {o}, Due: {d})"
            items.append(ListItem(Paragraph(text, normal_style)))
        story.append(ListFlowable(items, bulletType='bullet', bulletColor=colors.HexColor("#ef4444")))
        story.append(Spacer(1, 10))
        
    _add_section("Risks / Concerns", mom.get("risks_concerns"), True)
    _add_section("Next Steps", mom.get("next_steps"), True)
    
    if mom.get("next_meeting_date"):
        _add_section("Next Meeting", mom.get("next_meeting_date"), False)

    try:
        doc.build(story)
    except Exception as e:
        logger.error(f"Failed to build MoM PDF: {e}")
        raise HTTPException(status_code=500, detail="PDF generation failed.")

    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=500, detail="PDF generation failed.")

    safe_title = mom.get("title", "Meeting").replace(" ", "_").replace("/", "-")
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"MoM_{safe_title}.pdf"
    )
