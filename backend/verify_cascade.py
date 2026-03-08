import asyncio
import uuid
import sys
import os

# Add the current directory to sys.path so 'app' can be found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import AsyncSessionLocal
from app.models.plant import Plant
from app.models.taxon import Taxon
from app.models.enums import Rank, PlantingPlace
from sqlalchemy import select

async def verify():
    print("--- Starting Recursive Hierarchy Delete Verification ---")
    async with AsyncSessionLocal() as db:
        # 1. Setup: Create a hierarchy: Genus -> Species
        genus_id = uuid.uuid4()
        species_id = uuid.uuid4()
        
        genus = Taxon(
            id=genus_id,
            name="TestGenus " + str(uuid.uuid4())[:8],
            rank=Rank.GENUS
        )
        species = Taxon(
            id=species_id,
            name="TestSpecies " + str(uuid.uuid4())[:8],
            rank=Rank.SPECIES,
            parent_id=genus_id
        )
        db.add(genus)
        db.add(species)
        await db.flush()
        print(f"Created Hierarchy: {genus.name} (Genus) -> {species.name} (Species)")

        # 2. Setup: Create a Plant linked to Species
        plant_id = uuid.uuid4()
        plant = Plant(
            id=plant_id,
            common_name="Test Plant Hierarchy",
            category="Test",
            planting_place=PlantingPlace.BOTH,
            taxon_id=species_id
        )
        db.add(plant)
        await db.commit()
        print(f"Created Plant: {plant.common_name} linked to {species.name}")

        # --- Test logic (mimicking the endpoint) ---
        
        async def simulate_delete(p_id):
            async with AsyncSessionLocal() as d:
                res = await d.execute(select(Plant).filter(Plant.id == p_id))
                p_obj = res.scalars().first()
                if not p_obj: 
                    print(f"Plant {p_id} not found")
                    return
                t_id = p_obj.taxon_id
                print(f"Deleting plant {p_id}, associated taxon: {t_id}")
                await d.delete(p_obj)
                
                curr_t_id = t_id
                while curr_t_id:
                    # Logic copied exactly from plants.py
                    other_p_stmt = select(Plant).filter(Plant.taxon_id == curr_t_id, Plant.id != p_id)
                    other_p_res = await d.execute(other_p_stmt)
                    if other_p_res.scalars().first():
                        print(f"Taxon {curr_t_id} is still used by other plants, stopping.")
                        break
                    
                    other_c_stmt = select(Taxon).filter(Taxon.parent_id == curr_t_id)
                    other_c_res = await d.execute(other_c_stmt)
                    if other_c_res.scalars().first():
                        print(f"Taxon {curr_t_id} still has children, stopping.")
                        break
                    
                    t_to_del_res = await d.execute(select(Taxon).filter(Taxon.id == curr_t_id))
                    t_to_del = t_to_del_res.scalars().first()
                    if not t_to_del:
                        break
                    
                    p_parent_id = t_to_del.parent_id
                    print(f"Deleting taxon {t_to_del.name} ({t_to_del.rank})")
                    await d.delete(t_to_del)
                    await d.flush() 
                    curr_t_id = p_parent_id
                
                await d.commit()

        # 3. Delete the plant
        print("\nStep 3: Deleting plant...")
        await simulate_delete(plant_id)

        # 4. Verify Species and Genus are gone
        res_s = await db.execute(select(Taxon).filter(Taxon.id == species_id))
        res_g = await db.execute(select(Taxon).filter(Taxon.id == genus_id))
        
        species_exists = res_s.scalars().first() is not None
        genus_exists = res_g.scalars().first() is not None
        
        if not species_exists and not genus_exists:
            print("RESULT: Both Species and Genus deleted (CORRECT, recursive cleanup worked)")
        elif not species_exists and genus_exists:
            print("RESULT: Species deleted but Genus still exists (WRONG, Genus should have been cleaned up)")
        else:
            print("RESULT: Cleanup failed entirely.")

        # 5. Test with shared Genus
        print("\nStep 5: Testing with shared Genus...")
        g2_id = uuid.uuid4()
        s2_a_id = uuid.uuid4()
        s2_b_id = uuid.uuid4()
        
        g2 = Taxon(id=g2_id, name="SharedGenus", rank=Rank.GENUS)
        s2_a = Taxon(id=s2_a_id, name="SpeciesA", rank=Rank.SPECIES, parent_id=g2_id)
        s2_b = Taxon(id=s2_b_id, name="SpeciesB", rank=Rank.SPECIES, parent_id=g2_id)
        
        db.add_all([g2, s2_a, s2_b])
        await db.flush()
        
        p_a = Plant(common_name="Plant A", category="Test", planting_place=PlantingPlace.BOTH, taxon_id=s2_a_id)
        p_b = Plant(common_name="Plant B", category="Test", planting_place=PlantingPlace.BOTH, taxon_id=s2_b_id)
        db.add_all([p_a, p_b])
        await db.commit()
        
        print("Created Shared Genus with 2 Species and 2 Plants.")
        print("Deleting Plant A...")
        await simulate_delete(p_a.id)
        
        res_s_a = await db.execute(select(Taxon).filter(Taxon.id == s2_a_id))
        res_g_2 = await db.execute(select(Taxon).filter(Taxon.id == g2_id))
        
        if not res_s_a.scalars().first() and res_g_2.scalars().first():
            print("RESULT: Species A deleted, Genus preserved (CORRECT, Species B still exists)")
        else:
            print("RESULT: Logic failed in shared genus test.")

        # Cleanup
        rem_p_b = await db.execute(select(Plant).filter(Plant.common_name == "Plant B"))
        p_b_obj = rem_p_b.scalars().first()
        if p_b_obj: await db.delete(p_b_obj)
        
        rem_s_b = await db.execute(select(Taxon).filter(Taxon.id == s2_b_id))
        s_b_obj = rem_s_b.scalars().first()
        if s_b_obj: await db.delete(s_b_obj)
        
        rem_g2 = await db.execute(select(Taxon).filter(Taxon.id == g2_id))
        g2_obj = rem_g2.scalars().first()
        if g2_obj: await db.delete(g2_obj)
        await db.commit()

    print("\n--- Verification Finished ---")

if __name__ == "__main__":
    asyncio.run(verify())
