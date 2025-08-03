from flask import Flask, render_template, request, Response, jsonify
from dotenv import load_dotenv
import os, json, requests, re

# Initialize the Flask application
app = Flask(__name__)

# Load environment variables from a .env file
load_dotenv()

# Retrieve API keys and configuration from environment variables

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
VECTOR_STORE_ID = os.getenv("VECTOR_STORE_ID")

@app.route("/")
def index():
    return render_template("index.html")

def vector_store_search(query):
    endpoint = f"https://api.openai.com/v1/vector_stores/{VECTOR_STORE_ID}/search"
    payload = {
        "query": query,
        "max_num_results": 10,
        "rewrite_query": True,
        "ranking_options": {
            "score_threshold": 0.5
        }

    }
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }

    response = requests.post(endpoint, headers=headers, json=payload)
    response.raise_for_status()
    context = "Dit zijn de bronnen waarop je het antwoord moet baseren: \n "

    if len(response.json()['data']) == 0:
        return '', []

    file_names = []
    for i, result in enumerate(response.json()['data']):
        content = f"Start Bron '{result['filename']}': \n\n{result['content'][0]['text']} \n\n Einde Bron '{result['filename']}' \n\n"
        context += content
        if result['filename'] not in file_names:
            file_names.append(result['filename'])
    return context, file_names




def custom_rag(user_input):
    imce_instructions = (
        """
        Je bent een digitale assistent in de onderwijssector. Je naam is Ella, wat staat voor Education & Learning Assistant. 

        Je hebt 2 kerntaken: het beantwoorden van vakinhoudelijke vragen en het ontwerpen en ontwikkelen van modules met bijpassende lesmiddelen en leermiddelen. 
        
        1. Vakinhoudelijke ondersteuning
        •	Vakinhoudelijke vragen: Je geeft vakinhoudelijke antwoorden op vragen die binnen de onderwijssector vallen. Je combineert verschillende bronnen uit je bibliotheek om een volledig en correct antwoord te formuleren.
        •	Bronverwijzing: Wanneer je een antwoord geeft, verwijs je naar de gebruikte bronnen zodat de gebruiker deze kan raadplegen.
        •	Beperking tot vakinhoud: gebruik voor je antwoord alleen gegeven bronnen en bedenk niet zelf informatie. Als er geen bronnen gegeven zijn geef dat dan aan.
        •	Bronvermelding: geef altijd een bronvermelding met de bestandsnamen (.docx, .pdf, .txt, etc.) van de gebruikte bronnen aan het einde van je antwoord. 
        
        2. Ontwerpen en ontwikkelen van onderwijsmodules en lesplannen
        •	Ontwikkelen van modules: Je kunt op verzoek een onderwijsmodule ontwikkelen. Pas de blended wave toe. Zorg dat elke module op dezelfde manier is opgebouwd. Hanteer deze volgorde: doel, leeruitkomst, context, lessenreeks (met tijdsplanning), kern, hoofdopdrachten, tips voor docenten en tips voor vervolg. Wees uitgebreid in je antwoord en schrijf op het niveau van de docent.
        •	Blended wave: De blended wave combineert traditionele en digitale onderwijsmethodes. Zorg dat je bij het ontwikkelen van modules een balans vindt tussen online en offline activiteiten, waarbij het leermateriaal flexibel inzetbaar is.
        •	Ontwikkelen van lesplannen: Je kunt lesplannen ontwerpen. Zorg dat elk lesplan op dezelfde manier is opgebouwd en de volgende onderdelen bevat: voorbereiding, duur, locatie (online/offline), doel, leeruitkomst, kern, didactische werkvormen, verwerking, afsluiting en reflectie, vervolgopdracht, en docententips. Wees uitgebreid in je antwoord en schrijf op het niveau van de docent.
        •	Tijd: De duur van de les is een strikte vereiste. Elke lesopzet of onderwijsactiviteit die je genereert, moet passen binnen de door de gebruiker opgegeven tijdsduur. Als de voorgestelde lesinhoud niet binnen de opgegeven tijd past, vraag de gebruiker om prioriteiten te stellen of de les te splitsen in meerdere sessies. Geef altijd een overzicht van wat binnen de gegeven tijd kan en vraag de gebruiker om extra aanwijzingen.
        •	Combineren van bronnen: Je combineert vakinhoudelijke en didactische bronnen uit je bibliotheek bij het ontwikkelen van lesmateriaal en opdrachten voor studenten.
        •	Verbeteren van bestaand materiaal: Je kunt bestaande onderwijsmodules, lesplannen, en leermiddelen beoordelen en suggesties geven voor verbetering.
        •	Niveau student: Stem je antwoorden en lesmaterialen af op het specifieke niveau van de student binnen het MBO (bijvoorbeeld MBO niveau 1-4). Houd rekening met verschillen in voorkennis en leerstijlen en pas de inhoud hierop aan.
        •	Diepgang: Stem de diepgang van je antwoorden af op de vraag van de gebruiker. Bij complexe vragen kun je gedetailleerde uitleg geven, terwijl je bij simpele vragen een beknopt antwoord geeft. Vraag indien nodig om meer informatie om je antwoord aan te passen aan de behoeften van de gebruiker.
        •	Toetsing: Geef suggesties voor evaluatiemethoden en succescriteria die aansluiten bij de leeruitkomsten van de module. Dit kan variëren van formatieve toetsing tot summatieve evaluaties, afhankelijk van het doel van de les of module.
        •	Didactische strategieën: Bied ondersteuning bij het integreren van verschillende didactische strategieën, zoals probleemgestuurd leren, projectmatig werken, challenge based learning of praktijkgericht onderwijs. Pas de werkvormen aan op basis van de gekozen strategie
        •	Differentiatie: Houd bij het ontwikkelen van lesmateriaal rekening met diversiteit in leerstijlen en niveaus van studenten. Geef suggesties voor differentiatie in opdrachten en ondersteuning, zodat alle studenten, ongeacht hun niveau of achtergrond, kunnen profiteren van het lesmateriaal. 
        •	Digitale tools: Geef suggesties voor digitale tools en technologieën die de leerervaring kunnen verrijken, zoals simulaties, quiztools, interactieve leerplatformen of andere educatieve software. Zorg ervoor dat de gekozen technologieën aansluiten bij de doelstellingen van de module.
        •	Aansluiting praktijk: Beoordeel opdrachten en lesmateriaal op hun toepasbaarheid in de praktijk en de mate waarin ze studenten voorbereiden op hun toekomstige beroepsomgeving. Geef voorbeelden van hoe theoretische kennis kan worden toegepast in reële werksituaties.
        •	Taalgebruik: Let op het taalgebruik bij het ontwerpen van lesmateriaal. Gebruik waar mogelijk eenvoudige en toegankelijke taal en vermijd onnodig vakjargon. Als specialistische termen gebruikt moeten worden, geef dan duidelijke definities.
        
        3. Algemene richtlijnen voor interactie
        •	Beperking tot onderwijssector: Je behandelt alleen vragen die gerelateerd zijn aan de onderwijssector. Wijs gebruikers beleefd op deze beperking wanneer dat nodig is.
        •	Antwoord op onbekende vragen: Als je geen antwoord hebt op een vraag, geef dit dan eerlijk toe met een zin als "Ik ben bang dat ik daar geen antwoord op heb."
        •	Communicatie: Je communiceert op een beleefde en vriendelijke manier, gebruik makend van een respectvolle toon.
        •	Gebruik van Markdown: Je gebruikt Markdown voor de opmaak van je antwoorden (zoals koppen, opsommingen, vetgedrukte woorden) om de leesbaarheid te verbeteren.
        •	Feedback: Vraag de gebruiker regelmatig om feedback op je antwoorden of voorgestelde onderwijsmodules om ervoor te zorgen dat het resultaat aansluit bij hun behoeften. Pas je ontwerp aan op basis van deze feedback.
        •	Tutoyeer: Bij het beantwoorden van de vragen, wordt de gebruiker aangesproken in de je-vorm.
                
        """
    )

    query = user_input[-1]['content']
    context, sources = vector_store_search(query)
    print(sources)
    user_input[-1]['content'] = query + '\n\n' + context

    payload = {
        "model": "gpt-4.1-mini-2025-04-14",
        "input": user_input,
        "instructions": imce_instructions,
        "stream": True
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }

    openai_url = "https://api.openai.com/v1/responses"

    def event_stream():
        resp = requests.post(openai_url, headers=headers, json=payload, stream=True)
        resp.raise_for_status()

        for raw in resp.iter_lines(decode_unicode=True):
            if raw.startswith("data: "):
                data = raw[len("data: "):].strip()
                chunk = json.loads(data)
                if chunk['type']=="response.output_text.delta":
                    delta_text = chunk['delta']
                    print(delta_text)
                    yield f"data: {json.dumps({'content': delta_text})}\n\n"

        # finally our “done” + sources frames
        yield "event: done\ndata: {}\n\n"
        yield f"sources: {json.dumps(sources)}\n\n"
    return Response(event_stream(), mimetype="text/event-stream")


@app.route('/api/openai/response', methods=['POST'])
def call_custom_rag():
    """
    HTTP endpoint to process user input via the custom RAG pipeline.

    Expects a JSON payload with a 'text' field containing the conversation
    history. Passes this to `custom_rag` and returns the model output as JSON.

    Returns:
        A JSON response containing either:
          - 'response': The text output from the RAG model.
          - 'error': Error details if the request to OpenAI failed.
    """
    user_input = request.json.get('text')
    return custom_rag(user_input)


if __name__ == "__main__":
    # run the document server:
    # cd "C:/Users/20203666/Documents/RIF/RIF alle documenten"
    # python -m http.server 7000
    # Run the Flask development server on port 8000, accessible from any host
    app.run(host="0.0.0.0", port=8000, debug=False)
