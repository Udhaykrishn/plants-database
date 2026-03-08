import httpx
from typing import Optional, List
from fastapi import HTTPException

async def fetch_inaturalist_images(plant_name: str, page: int = 1) -> List[str]:
    """
    Fetch images from iNaturalist API for a given plant name.
    """
    # Replace spaces with + for the URL
    query_name = plant_name.replace(" ", "+")
    
    # iconic_taxa=Plantae ensures we get plants, not animals
    url = f"https://api.inaturalist.org/v1/observations?taxon_name={query_name}&photos=true&per_page=2&page={page}&iconic_taxa=Plantae"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch images from iNaturalist: {str(e)}")

    photo_urls = []
    
    # The API returns 'results', which are observations. 
    # Each observation has 'photos'.
    for r in data.get("results", []):
        for p in r.get("photos", []):
            photo_urls.append(p.get("url"))
            if len(photo_urls) >= 2:
                break
        if len(photo_urls) >= 2:
            break
            
    return photo_urls
