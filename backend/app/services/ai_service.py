import json
import google.generativeai as genai
from fastapi import HTTPException
from app.core.config import settings
from app.schemas.ai import PlantAIDetailsResponse, TaxonomyDetails

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

async def generate_plant_details(common_name: str) -> PlantAIDetailsResponse:
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured")

    generation_config = {
      "temperature": 0.2,
      "top_p": 0.95,
      "top_k": 40,
      "max_output_tokens": 2048,
    }

    model = genai.GenerativeModel(
      model_name="gemini-2.5-flash", 
      generation_config=generation_config,
    )

    prompt = f"""
    You are an expert botanist and horticulturist.
    Please provide detailed information for the plant with the common name "{common_name}".
    Your response must be in valid JSON format exactly matching this structure, returning null for values you are uncertain about:
    {{
      "category": "String (best matching one of: Tree, Shrub, Palm, Creeper, Groundcover, Climber, Fern, Grass, Succulent, Aquatic, or Other)",
      "planting_place": "String (must be exactly one of: 'Indoor', 'Outdoor', 'Indoor & Outdoor')",
      "description": "String (a short, simple, and very concise description using plain language)",
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
      }}
    }}
    """
    
    try:
        response = model.generate_content(prompt)
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
            category=data.get("category"),
            planting_place=data.get("planting_place"),
            description=data.get("description"),
            care_data=data.get("care_data"),
            taxonomy=taxonomy
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate AI details: {str(e)}")
