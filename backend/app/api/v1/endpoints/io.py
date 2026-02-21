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

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import io
import re

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
        .options(selectinload(Project.plants).selectinload(ProjectPlant.plant).selectinload(Plant.taxon))
    )
    project = result.scalars().first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Generate PDF using ReportLab Platypus
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
        title=f"{project.name} - Plant Report"
    )

    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=12,
        alignment=0
    )
    subtitle_style = ParagraphStyle(
        'SubTitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#666666'),
        spaceAfter=4
    )
    heading2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=colors.HexColor('#1a1a1a'),
        spaceBefore=20,
        spaceAfter=10,
        borderPadding=0
    )
    plant_title_style = ParagraphStyle(
        'PlantTitle',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#1a1a1a'),
        spaceBefore=0,
        spaceAfter=5
    )
    plant_sub_style = ParagraphStyle(
        'PlantSub',
        parent=styles['Normal'],
        fontSize=11,
        textColor=colors.HexColor('#444444'),
        fontName='Helvetica-Oblique',
        spaceAfter=10
    )
    normal_style = styles['Normal']

    story = []

    # Cover / Header
    story.append(Paragraph(project.name, title_style))
    if project.client_name:
        story.append(Paragraph(f"<b>Client:</b> {project.client_name}", subtitle_style))
    if project.location:
        story.append(Paragraph(f"<b>Location:</b> {project.location}", subtitle_style))
    if project.description:
        story.append(Spacer(1, 10))
        story.append(Paragraph(project.description, normal_style))
    
    story.append(Spacer(1, 20))

    # Master Plants List
    story.append(Paragraph("Project Plants Overview", heading2_style))
    
    categories = {}
    for pp in project.plants:
        if pp.plant:
            cat_name = pp.plant.category.value if pp.plant.category else "Other"
            if cat_name not in categories:
                categories[cat_name] = []
            categories[cat_name].append(pp)
            
    if not categories:
        story.append(Paragraph("No plants associated with this project.", normal_style))
    else:
        global_sl = 1
        cat_style = ParagraphStyle(
            'CategoryHeading',
            parent=styles['Heading3'],
            fontSize=14,
            textColor=colors.HexColor('#444444'),
            spaceBefore=15,
            spaceAfter=8
        )
        for cat_name, pps in sorted(categories.items()):
            story.append(Paragraph(cat_name, cat_style))
            
            table_data = [['Sl No.', 'Common Name', 'Scientific Name', 'Notes']]
            
            for pp in pps:
                p = pp.plant
                scientific = f"<i>{p.taxon.name if p.taxon else '-'}</i>"
                common_linked = f'<font color="#0056b3"><link href="#plant_{p.id}">{p.common_name or "Unknown"}</link></font>'
                
                row = [
                    Paragraph(str(global_sl), normal_style),
                    Paragraph(common_linked, normal_style),
                    Paragraph(scientific, normal_style),
                    Paragraph(pp.notes or "", normal_style)
                ]
                table_data.append(row)
                global_sl += 1

            list_table = Table(table_data, colWidths=[0.6*inch, 2*inch, 2*inch, 2.4*inch])
            list_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#fafafa')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#666666')),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TOPPADDING', (0, 0), (-1, 0), 8),
                ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor('#eaeaea')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            story.append(list_table)

    # Individual Plant Detail Pages
    for pp in project.plants:
        p = pp.plant
        if not p:
            continue
            
        story.append(PageBreak())
        
        anchor_p = f'<a name="plant_{p.id}"/>{p.common_name or "Unknown Plant"}'
        story.append(Paragraph(anchor_p, plant_title_style))
        scientific_name = p.taxon.name if p.taxon else "Unknown Species"
        category = p.category.value if p.category else "Other"
        story.append(Paragraph(f"{scientific_name}  •  {category}", plant_sub_style))
        story.append(Spacer(1, 15))
        
        # Detail Table for Plant
        details = []
        if p.description:
            details.append(['Description', Paragraph(p.description, normal_style)])
            
        placement = p.planting_place.value if p.planting_place else "-"
        details.append(['Placement', placement])
            
        if p.care_data:
            for key, val in p.care_data.items():
                if val:
                    key_fmt = str(key).replace('_', ' ').title()
                    details.append([key_fmt, Paragraph(str(val), normal_style)])
            
        if pp.notes:
            details.append(['Project Notes', Paragraph(pp.notes, normal_style)])

        if details:
            detail_table = Table(details, colWidths=[1.5*inch, 5.5*inch])
            detail_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
                ('PADDING', (0, 0), (-1, -1), 6),
                ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#eaeaea')),
            ]))
            story.append(detail_table)
            
    doc.build(story)
    
    buffer.seek(0)
    
    safe_name = re.sub(r'[\\/*?:"<>|]', "", project.name)
    
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'}
    )
