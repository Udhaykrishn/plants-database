import json
from typing import Optional
import google.generativeai as genai
from fastapi import HTTPException
from app.core.config import settings
from app.schemas.ai import PlantAIDetailsResponse, TaxonomyDetails

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

async def generate_plant_details(common_name: Optional[str] = None, scientific_name: Optional[str] = None) -> PlantAIDetailsResponse:
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured")

    generation_config = {
      "temperature": 0.2,
      "top_p": 0.95,
      "top_k": 40,
      "max_output_tokens": 2048,
    }

    model = genai.GenerativeModel(
      model_name="models/gemini-2.5-flash", 
      generation_config=generation_config,
    )

    plant_query = ""
    if scientific_name and common_name:
        plant_query = f'scientific name "{scientific_name}" (also known as "{common_name}")'
    elif scientific_name:
        plant_query = f'scientific name "{scientific_name}"'
    elif common_name:
        plant_query = f'common name "{common_name}"'
    else:
        raise HTTPException(status_code=400, detail="Must provide at least one name")

    prompt = f"""
    You are an expert botanist and horticulturist.
    Please provide detailed information for the plant with the {plant_query}.
    Your response must be in valid JSON format exactly matching this structure, returning null for values you are uncertain about:
    {{
      "common_name": "String (the most widely used English common name for this plant)",
      "category": "String (best matching one of: Tree, Shrub, Palm, Creeper, Groundcover, Climber, Fern, Grass, Succulent, Aquatic, or Other)",
      "planting_place": "String (must be exactly one of: 'Indoor', 'Outdoor', 'Indoor & Outdoor')",
      "description": "String (a short, simple, and very concise description using plain language)",
      "common_diseases": "String (a short, simple bulleted list of common diseases and pests, using '•')",
      "care_data": {{
        "water": "String (concise instructions in simple language, formatted as short bullet points using '•')",
        "sunlight": "String (concise instructions in simple language, formatted as short bullet points using '•')",
        "soil": "String (concise instructions in simple language, formatted as short bullet points using '•')",
        "maintenance": "String (concise instructions in simple language, formatted as short bullet points using '•')"
      }},
      "taxonomy": {{
        "kingdom": "String",
        "division": "String (Phylum/Division)",
        "class_name": "String",
        "order": "String",
        "family": "String",
        "genus": "String",
        "species": "String (Just the species epithet if possible, e.g. 'monstera' in Monstera deliciosa, or the full binomial name)"
      }},
      "icon_url": "String (Direct Special:FilePath URL to a Wikimedia Commons image. CRITICAL: Use ONLY the most likely standard filename, usually exactly 'Scientific_Name.jpg' (with underscores). Format: https://commons.wikimedia.org/wiki/Special:FilePath/<Scientific_Name>.jpg?width=400. DO NOT add descriptive words like 'fruit' or 'leaves' to the filename unless you are 100% sure it exists. If the scientific name is 'Mangifera indica', use 'Mangifera_indica.jpg'. Return null if uncertain.)",
      "image_url": "String (Same as above with width=1000. Prefer the exact scientific name filename 'Scientific_Name.jpg'. Only use variant filenames if you are certain they are the primary image for this plant on Commons. Return null if uncertain.)"
    }}
    ONLY return the JSON object, do not include any other text or explanation. Ensure all strings are properly escaped.
    """
    
    try:
        response = await model.generate_content_async(prompt)
        # response_text might be wrapped in ```json ... ``` or directly stringified JSON
        response_text = response.text.strip()
        
        # Strip potential markdown formatting
        if response_text.startswith("```json"):
            response_text = response_text[7:-3]
        elif response_text.startswith("```"):
            response_text = response_text[3:-3]
            
        data = json.loads(response_text)
        
        tax_data = data.get("taxonomy", {})
        taxonomy = TaxonomyDetails(
            kingdom=tax_data.get("kingdom"),
            division=tax_data.get("division"),
            class_name=tax_data.get("class_name"),
            order=tax_data.get("order"),
            family=tax_data.get("family"),
            genus=tax_data.get("genus"),
            species=tax_data.get("species"),
        )
        
        return PlantAIDetailsResponse(
            common_name=data.get("common_name"),
            category=data.get("category"),
            planting_place=data.get("planting_place"),
            description=data.get("description"),
            common_diseases=data.get("common_diseases"),
            care_data=data.get("care_data"),
            taxonomy=taxonomy,
            icon_url=data.get("icon_url"),
            image_url=data.get("image_url")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate AI details: {str(e)}")
