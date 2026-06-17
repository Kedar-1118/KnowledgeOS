from fastapi import APIRouter
import google.generativeai as genai
import json
import os

router = APIRouter()

# Configure Gemini with the API key from environment
gemini_api_key = os.environ.get("GEMINI_API_KEY", "")
if gemini_api_key:
    genai.configure(api_key=gemini_api_key)

PROMPT_TEMPLATE = """
Analyze the following text chunk and generate 3 spaced-repetition flashcards.
Output ONLY valid JSON matching this schema:
[{ "cardType": "QA", "question": "...", "answer": "...", "difficultyScore": 3 }]

Possible cardTypes are QA, DEFINITION, FILL_BLANK, CONCEPT.
difficultyScore must be an integer from 1 to 5.
Text: {text}
"""

@router.post("/generate-cards")
async def generate_cards(payload: dict):
    if not gemini_api_key:
        return {"error": "GEMINI_API_KEY not configured"}

    model = genai.GenerativeModel('gemini-1.5-pro')
    cards = []
    chunks = payload.get("chunks", [])
    
    for chunk in chunks:
        try:
            response = model.generate_content(
                PROMPT_TEMPLATE.format(text=chunk["content"]),
                generation_config={"response_mime_type": "application/json"}
            )
            parsed = json.loads(response.text)
            for c in parsed:
                c["sourceChunkId"] = chunk.get("id")
                cards.append(c)
        except Exception as e:
            # Silently skip failed chunks or log them
            pass
            
    return {"cards": cards}
