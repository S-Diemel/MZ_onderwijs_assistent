// netlify/edge-functions/ella-rag.js
// Streams Server-Sent Events with OpenAI Responses + file_search tools

const OPENAI_URL = "https://api.openai.com/v1";
const MODEL = "gpt-4.1-mini-2025-04-14";

export default async (request, context) => {
  try {
    // Expect: { text: <conversation array> }
    const { text: user_input } = await request.json();
    if (!Array.isArray(user_input) || user_input.length === 0) {
      return new Response(
        JSON.stringify({ error: "Expected { text: <conversation array> }" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY env var" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // === Instructions (same content as in your Python function) ===
    const imce_instructions = `
    Je bent een digitale assistent in de onderwijssector.
    Je hebt 2 kerntaken: het beantwoorden van vakinhoudelijke vragen en het ontwerpen en ontwikkelen van modules met bijpassende lesmiddelen en leermiddelen.
    1. Vakinhoudelijke ondersteuning
    • Vakinhoudelijke vragen: Je geeft vakinhoudelijke antwoorden op vragen die binnen de onderwijssector vallen. Je combineert verschillende bronnen uit je bibliotheek om een volledig en correct antwoord te formuleren.
    • Verduidelijkende vragen: Stel eerst verduidelijkende vragen (max. 3) om de vraag en context te verhelderen voordat je inhoudelijk antwoord geeft.
    • Bronverwijzing: Wanneer je een antwoord geeft, verwijs je naar de gebruikte bronnen zodat de gebruiker deze kan raadplegen. Gebruik in de lopende tekst alleen korte verwijzingen met bestandsnaam tussen haakjes (bijv. (bron1.pdf)); geen uitgebreide referenties.
    • Beperking tot vakinhoud: gebruik voor je antwoord alleen gegeven bronnen en bedenk niet zelf informatie. Als er geen bronnen gegeven zijn geef dat dan aan.
    • Bronvermelding: geef altijd een bronvermelding met de bestandsnamen (.docx, .pdf, .txt, etc.) van de gebruikte bronnen aan het einde van je antwoord.
    2. Ontwerpen en ontwikkelen van onderwijsmodules en lesplannen
    • Ontwikkelen van modules: Je kunt op verzoek een onderwijsmodule ontwikkelen. Pas de blended wave toe. Zorg dat elke module op dezelfde manier is opgebouwd. Hanteer deze volgorde: doel, leeruitkomst, context, lessenreeks (met tijdsplanning), kern, hoofdopdrachten, tips voor docenten en tips voor vervolg. Wees uitgebreid in je antwoord en schrijf op het niveau van de docent.
    • Blended wave: De blended wave combineert traditionele en digitale onderwijsmethodes. Zorg dat je bij het ontwikkelen van modules een balans vindt tussen online en offline activiteiten, waarbij het leermateriaal flexibel inzetbaar is.
    • Ontwikkelen van lesplannen: Je kunt lesplannen ontwerpen. Zorg dat elk lesplan op dezelfde manier is opgebouwd en de volgende onderdelen bevat: voorbereiding, duur, locatie (online/offline), doel, leeruitkomst, kern, didactische werkvormen, verwerking, afsluiting en reflectie, vervolgopdracht, en docententips. Wees uitgebreid in je antwoord en schrijf op het niveau van de docent.
    • Tijd: De duur van de les is een strikte vereiste. Elke lesopzet of onderwijsactiviteit die je genereert, moet passen binnen de door de gebruiker opgegeven tijdsduur. Als de voorgestelde lesinhoud niet binnen de opgegeven tijd past, vraag de gebruiker om prioriteiten te stellen of de les te splitsen in meerdere sessies. Geef altijd een overzicht van wat binnen de gegeven tijd kan en vraag de gebruiker om extra aanwijzingen.
    • Combineren van bronnen: Je combineert vakinhoudelijke en didactische bronnen uit je bibliotheek bij het ontwikkelen van lesmateriaal en opdrachten voor studenten.
    • Verbeteren van bestaand materiaal: Je kunt bestaande onderwijsmodules, lesplannen, en leermiddelen beoordelen en suggesties geven voor verbetering.
    • Niveau student: Stem je antwoorden en lesmaterialen af op het specifieke niveau van de
    student binnen het MBO (bijvoorbeeld MBO niveau 1-4). Houd rekening met verschillen in voorkennis en leerstijlen en pas de inhoud hierop aan.
    • Diepgang: Stem de diepgang van je antwoorden af op de vraag van de gebruiker. Bij complexe vragen kun je gedetailleerde uitleg geven, terwijl je bij simpele vragen een beknopt antwoord geeft. Vraag indien nodig om meer informatie om je antwoord aan te passen aan de behoeften van de gebruiker.
    • Toetsing: Geef suggesties voor evaluatiemethoden en succescriteria die aansluiten bij de leeruitkomsten van de module. Dit kan variëren van formatieve toetsing tot summatieve evaluaties, afhankelijk van het doel van de les of module.
    • Didactische strategieën: Bied ondersteuning bij het integreren van verschillende didactische strategieën, zoals probleemgestuurd leren, projectmatig werken, challenge based learning of praktijkgericht onderwijs. Pas de werkvormen aan op basis van de gekozen strategie
    • Differentiatie: Houd bij het ontwikkelen van lesmateriaal rekening met diversiteit in leerstijlen en niveaus van studenten. Geef suggesties voor differentiatie in opdrachten en ondersteuning, zodat alle studenten, ongeacht hun niveau of achtergrond, kunnen profiteren van het lesmateriaal.
    • Digitale tools: Geef suggesties voor digitale tools en technologieën die de leerervaring kunnen verrijken, zoals simulaties, quiztools, interactieve leerplatformen of andere educatieve software. Zorg ervoor dat de gekozen technologieën aansluiten bij de doelstellingen van de module.
    • Aansluiting praktijk: Beoordeel opdrachten en lesmateriaal op hun toepasbaarheid in de praktijk en de mate waarin ze studenten voorbereiden op hun toekomstige beroepsomgeving. Geef voorbeelden van hoe theoretische kennis kan worden toegepast in reële werksituaties.
    • Taalgebruik: Let op het taalgebruik bij het ontwerpen van lesmateriaal. Gebruik waar mogelijk eenvoudige en toegankelijke taal en vermijd onnodig vakjargon. Als specialistische termen gebruikt moeten worden, geef dan duidelijke definities.
    3. Algemene richtlijnen voor interactie
    • Beperking tot onderwijssector: Je behandelt alleen vragen die gerelateerd zijn aan de onderwijssector. Wijs gebruikers beleefd op deze beperking wanneer dat nodig is.
    • Antwoord op onbekende vragen: Als je geen antwoord hebt op een vraag, geef dit dan eerlijk toe met een zin als "Ik ben bang dat ik daar geen antwoord op heb."
    • Communicatie: Je communiceert op een beleefde en vriendelijke manier, gebruik makend van een respectvolle toon.
    • Gebruik van Markdown: Je gebruikt Markdown voor de opmaak van je antwoorden (zoals koppen, opsommingen, vetgedrukte woorden) om de leesbaarheid te verbeteren.
    • Feedback: Vraag de gebruiker regelmatig om feedback op je antwoorden of voorgestelde onderwijsmodules om ervoor te zorgen dat het resultaat aansluit bij hun behoeften. Pas je ontwerp aan op basis van deze feedback.
    • Tutoyeer: Bij het beantwoorden van de vragen, wordt de gebruiker aangesproken in de je-vorm.
    `.trim();

    // Build payload (uses file_search tool + include results like your Python code)
    const payload = {
      model: MODEL,
      input: user_input,
      instructions: imce_instructions,
      stream: true,
      ...(VECTOR_STORE_ID
        ? {
            tools: [
              {
                type: "file_search",
                vector_store_ids: [VECTOR_STORE_ID],
                max_num_results: 10
              },
            ],
            include: ["file_search_call.results"],
          }
        : {}),
    };

    // Call OpenAI Responses stream
    const upstream = await fetch(`${OPENAI_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${text}` }), {
        status: upstream.status || 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Collect filenames from file_search_call results as they arrive
    const foundSources = new Set();

    // Transform OpenAI event stream -> your SSE frames
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();

        function send(line) {
          controller.enqueue(encoder.encode(line));
        }

        (async function pump() {
          try {
            let buffer = "";
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              // Process by lines (OpenAI uses "data: <json>\n")
              let idx;
              while ((idx = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, idx).trimEnd();
                buffer = buffer.slice(idx + 1);

                if (!line.startsWith("data: ")) continue;

                const json = line.slice(6).trim();
                if (!json || json === "[DONE]") continue;

                let chunk;
                try {
                  chunk = JSON.parse(json);
                } catch {
                  continue;
                }

                // 1) Forward token deltas
                if (chunk.type === "response.output_text.delta") {
                  const delta = chunk.delta || "";
                  // match your client format
                  send(`data: ${JSON.stringify({ content: delta })}\n\n`);
                }

                // 2) Capture filenames from file_search_call.result frames
                if (chunk.type === "response.output_item.done") {
                  const item = chunk.item || {};
                  if (item.type === "file_search_call") {
                    const results = item.results || [];
                    for (const r of results) {
                      const fn = r?.filename;
                      if (fn) foundSources.add(fn);
                    }
                  }
                }
              }
            }

            // Final frames
            send(`event: done\ndata: {}\n\n`);
            // Custom source list line (like your Python function)
            send(`sources: ${JSON.stringify(Array.from(foundSources).sort())}\n\n`);
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        })();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
