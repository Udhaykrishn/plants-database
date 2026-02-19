import csv
import io
import uuid
from typing import IO, List, Dict, Tuple, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.taxon import Taxon
from app.models.plant import Plant
from app.models.enums import Rank, PlantCategory, PlantingPlace
from app.schemas.taxon import TaxonCreate

async def process_csv_import(db: AsyncSession, file_content: bytes) -> Dict[str, Any]:
    """
    Process CSV content to import plants and creating taxonomy hierarchy.
    """
    decoded_file = file_content.decode("utf-8")
    csv_reader = csv.DictReader(io.StringIO(decoded_file))
    
    # Normalize headers
    headers = [h.strip().lower() for h in csv_reader.fieldnames or []]
    required = ["kingdom", "species", "common_name"]
    missing = [req for req in required if req not in headers]
    
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")
    
    # Store results
    results = {
        "success": 0,
        "failed": 0,
        "errors": []
    }
    
    # Rank order for iteration (excluding Species which is handled last)
    hierarchy_ranks = [
        Rank.KINGDOM,
        Rank.DIVISION,
        Rank.CLASS,
        Rank.ORDER,
        Rank.FAMILY,
        Rank.GENUS
    ]

    row_idx = 0
    for row in csv_reader:
        row_idx += 1
        row = {k.strip().lower(): v.strip() for k, v in row.items()}
        
        try:
            # 1. Build Taxonomy Hierarchy
            parent_id = None
            
            for rank in hierarchy_ranks:
                rank_str = rank.value.lower()
                name = row.get(rank_str)
                
                if not name:
                    # Specific logic: If a rank is missing in CSV, we might skip it or error.
                    # For a robust botanical system, usually ALL levels are required, 
                    # but sometimes data is missing.
                    # Here we assume if missing, we just skip creating this node and attach to previous parent?
                    # No, taxonomy is strict. Let's assume mandatory for simple logic or fail.
                    if rank == Rank.KINGDOM:
                         raise ValueError("Kingdom is mandatory")
                    else:
                         # Try to find 'unspecified' or continue? 
                         # Let's enforce strictness for this implementation or allow missing logic
                         # For now: Skip if empty, but next rank will point to previous parent
                         continue
                
                # Check existance
                stmt = select(Taxon).where(
                    Taxon.name == name,
                    Taxon.rank == rank,
                    Taxon.parent_id == parent_id
                )
                result = await db.execute(stmt)
                taxon = result.scalars().first()
                
                if not taxon:
                    # Create new Taxon
                    taxon = Taxon(
                        name=name,
                        rank=rank,
                        parent_id=parent_id
                    )
                    db.add(taxon)
                    await db.flush() # Flush to get ID
                
                parent_id = taxon.id
                
            # 2. Handle Species (Taxon)
            species_name = row.get("species")
            if not species_name:
                raise ValueError("Species name mandatory")
                
            stmt = select(Taxon).where(
                Taxon.name == species_name,
                Taxon.rank == Rank.SPECIES,
                Taxon.parent_id == parent_id
            )
            result = await db.execute(stmt)
            species_taxon = result.scalars().first()
            
            if not species_taxon:
                species_taxon = Taxon(
                    name=species_name,
                    rank=Rank.SPECIES,
                    parent_id=parent_id
                )
                db.add(species_taxon)
                await db.flush()
            
            # 3. Create/Update Plant
            common_name = row.get("common_name")
            if not common_name:
                raise ValueError("Common name Mandatory")
                
            # Helper for enums
            category_str = row.get("category", "Other").title()
            try:
                category = PlantCategory(category_str)
            except ValueError:
                category = PlantCategory.OTHER
                
            place_str = row.get("planting_place", "Both").title()
            try:
                planting_place = PlantingPlace(place_str)
            except ValueError:
                planting_place = PlantingPlace.BOTH

            # Check if plant exists
            stmt = select(Plant).where(Plant.taxon_id == species_taxon.id)
            result = await db.execute(stmt)
            plant = result.scalars().first()
            
            if not plant:
                plant = Plant(
                    taxon_id=species_taxon.id,
                    common_name=common_name,
                    category=category,
                    planting_place=planting_place,
                    description=row.get("description", "")
                )
                db.add(plant)
                results["success"] += 1
            else:
                 # Update? Skip for now to avoid overwriting user edits, 
                 # or maybe just update specific fields.
                 # Let's Skip duplicates in this version.
                 pass
                 
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"Row {row_idx}: {str(e)}")
            continue

    await db.commit()
    return results
