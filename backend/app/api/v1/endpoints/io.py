from typing import Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.services.import_service import process_csv_import
from app.models.project import Project, ProjectPlant
from app.models.plant import Plant

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io

router = APIRouter()

@router.post("/import/csv")
async def import_plants_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Import plants from CSV.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be CSV")
    
    content = await file.read()
    try:
        results = await process_csv_import(db, content)
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@router.get("/export/pdf/project/{project_id}")
async def export_project_pdf(
    project_id: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Generate PDF report for project.
    """
    # Fetch Project Data
    result = await db.execute(
        select(Project)
        .filter(Project.id == project_id)
        .options(selectinload(Project.plants).selectinload(ProjectPlant.plant))
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Generate PDF using ReportLab
    buffer = io.BytesIO()
    p = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    
    # Title
    p.setFont("Helvetica-Bold", 18)
    p.drawString(50, height - 50, f"Project: {project.name}")
    
    p.setFont("Helvetica", 12)
    p.drawString(50, height - 70, f"Client: {project.client_name or '-'}")
    p.drawString(50, height - 90, f"Location: {project.location or '-'}")
    
    # Plant List Header
    y = height - 130
    p.setFont("Helvetica-Bold", 12)
    p.drawString(50, y, "Plant")
    p.drawString(300, y, "Qty")
    p.drawString(400, y, "Notes")
    
    p.line(50, y - 5, 550, y - 5)
    y -= 25
    
    # Rows
    p.setFont("Helvetica", 10)
    for pp in project.plants:
        plant_name = pp.plant.common_name if pp.plant else "Unknown"
        qty = str(pp.quantity)
        notes = pp.notes or ""
        
        p.drawString(50, y, plant_name)
        p.drawString(300, y, qty)
        p.drawString(400, y, notes)
        
        y -= 20
        if y < 50:
            p.showPage()
            y = height - 50
            
    p.save()
    
    buffer.seek(0)
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=project_report_{project.id}.pdf"}
    )
