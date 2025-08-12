// Streams Server-Sent Events (true SSE compatible with EventSource)

const OPENAI_URL = "https://api.openai.com/v1";
const MODEL = "gpt-4.1-mini-2025-04-14";

export default async (request, context) => {
  try {
    const { text: user_input } = await request.json();
    if (!Array.isArray(user_input) || user_input.length === 0) {
      return new Response(JSON.stringify({ error: "Expected { text: <conversation array> }" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;
    const VECTOR_STORE_ID = process.env.VECTOR_STORE_ID;

    async function vectorStoreSearchCheck(query) {
      const search_check_instructions = `
Je bent een AI die uitsluitend reageert met "ja" of "nee", op basis van de volgende strikte regel:

Antwoord "ja" als er een opdracht wordt gegeven of als de vraag of opmerking inhoudelijk of taakgericht is (bijvoorbeeld over feiten, opdrachten, uitleg, hulpvragen, lesplan, modules).

Antwoord "nee" als de vraag of opmerking small talk of sociaal van aard is (bijvoorbeeld begroetingen, beleefdheidsvragen, persoonlijke opmerkingen).

Gebruik uitsluitend het woord "ja" of "nee", zonder verdere toelichting of variatie. Geen uitzonderingen.
      `.trim();

      const payload = {
        model: MODEL,
        input: query,
        instructions: search_check_instructions
      };

      const r = await fetch(`${OPENAI_URL}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!r.ok) return false;
      const d = await r.json();
      const text = d.output_text ?? d.output?.[0]?.content?.[0]?.text ?? "";
      return /\bja\.?\b/i.test(text);
    }

    async function vectorStoreSearch(query) {
      if (!VECTOR_STORE_ID) return { context: "", sources: [] };

      const endpoint = `${OPENAI_URL}/vector_stores/${VECTOR_STORE_ID}/search`;
      const payload = {
        query,
        max_num_results: 10,
        rewrite_query: true,
        ranking_options: { score_threshold: 0.5 }
      };

      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!r.ok) return { context: "", sources: [] };
      const data = await r.json();
      if (!data?.data?.length) return { context: "", sources: [] };

      let contextText = "Dit zijn de bronnen waarop je het antwoord moet baseren: \n ";
      const files = [];
      for (const result of data.data) {
        const filename = result.filename;
        const snippet = result.content?.[0]?.text || "";
        contextText += `Start Bron '${filename}': \n\n${snippet} \n\n Einde Bron '${filename}' \n\n`;
        if (filename && !files.includes(filename)) files.push(filename);
      }
      return { context: contextText, sources: files };
    }

    const imce_instructions =  `
                              Je bent een digitale assistent in de onderwijssector. Je naam is Ella, wat staat voor Education & Learning Assistant.

                              Je hebt 2 kerntaken: het beantwoorden van vakinhoudelijke vragen en het ontwerpen en ontwikkelen van modules met bijpassende lesmiddelen en leermiddelen.

                              1. Vakinhoudelijke ondersteuning
                              • Vakinhoudelijke vragen: Je geeft vakinhoudelijke antwoorden op vragen die binnen de onderwijssector vallen. Je combineert verschillende bronnen uit je bibliotheek om een volledig en correct antwoord te formuleren.
                              • Bronverwijzing: Wanneer je een antwoord geeft, verwijs je naar de gebruikte bronnen zodat de gebruiker deze kan raadplegen.
                              • Beperking tot vakinhoud: gebruik voor je antwoord alleen gegeven bronnen en bedenk niet zelf informatie. Als er geen bronnen gegeven zijn geef dat dan aan.
                              • Bronvermelding: geef altijd een bronvermelding met de bestandsnamen (.docx, .pdf, .txt, etc.) van de gebruikte bronnen aan het einde van je antwoord.

                              2. Ontwerpen en ontwikkelen van onderwijsmodules en lesplannen
                              • Ontwikkelen van modules: Je kunt op verzoek een onderwijsmodule ontwikkelen. Pas de blended wave toe. Zorg dat elke module op dezelfde manier is opgebouwd. Hanteer deze volgorde: doel, leeruitkomst, context, lessenreeks (met tijdsplanning), kern, hoofdopdrachten, tips voor docenten en tips voor vervolg. Wees uitgebreid in je antwoord en schrijf op het niveau van de docent.
                              • Blended wave: De blended wave combineert traditionele en digitale onderwijsmethodes. Zorg dat je bij het ontwikkelen van modules een balans vindt tussen online en offline activiteiten, waarbij het leermateriaal flexibel inzetbaar is.
                              • Ontwikkelen van lesplannen: Je kunt lesplannen ontwerpen. Zorg dat elk lesplan op dezelfde manier is opgebouwd en de volgende onderdelen bevat: voorbereiding, duur, locatie (online/offline), doel, leeruitkomst, kern, didactische werkvormen, verwerking, afsluiting en reflectie, vervolgopdracht, en docententips. Wees uitgebreid in je antwoord en schrijf op het niveau van de docent.
                              • Tijd: De duur van de les is een strikte vereiste. Elke lesopzet of onderwijsactiviteit die je genereert, moet passen binnen de door de gebruiker opgegeven tijdsduur. Als de voorgestelde lesinhoud niet binnen de opgegeven tijd past, vraag de gebruiker om prioriteiten te stellen of de les te splitsen in meerdere sessies. Geef altijd een overzicht van wat binnen de gegeven tijd kan en vraag de gebruiker om extra aanwijzingen.
                              • Combineren van bronnen: Je combineert vakinhoudelijke en didactische bronnen uit je bibliotheek bij het ontwikkelen van lesmateriaal en opdrachten voor studenten.
                              • Verbeteren van bestaand materiaal: Je kunt bestaande onderwijsmodules, lesplannen, en leermiddelen beoordelen en suggesties geven voor verbetering.
                              • Niveau student: Stem je antwoorden en lesmaterialen af op het specifieke niveau van de student binnen het MBO (bijvoorbeeld MBO niveau 1-4). Houd rekening met verschillen in voorkennis en leerstijlen en pas de inhoud hierop aan.
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

    const last = user_input[user_input.length - 1];
    const query = last?.content || "";
    let contextText = "";
    let sources = [];

    try {
      if (await vectorStoreSearchCheck(query)) {
        const r = await vectorStoreSearch(query);
        contextText = r.context;
        sources = r.sources;
      }
    } catch {
      // best-effort enrichment; ignore failures
    }

    const augmented = [...user_input];
    augmented[augmented.length - 1] = {
      ...last,
      content: `${query}\n\n${contextText}`.trim()
    };

    const payload = {
      model: MODEL,
      input: augmented,
      instructions: imce_instructions,
      stream: true
    };

    const upstream = await fetch(`${OPENAI_URL}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${text}` }), {
        status: upstream.status || 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // True SSE stream for EventSource clients
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();

        let nextId = 1;
        let heartbeat;
        const send = (lines) => controller.enqueue(encoder.encode(lines));
        const sendEvent = (event, dataObj) => {
          const id = String(nextId++);
          const data = JSON.stringify(dataObj);
          send(`id: ${id}\nevent: ${event}\ndata: ${data}\n\n`);
        };
        const sendComment = (comment) => send(`: ${comment}\n\n`);

        // Heartbeat every 15s so proxies keep the connection open
        heartbeat = setInterval(() => {
          try { sendComment("keep-alive"); } catch {}
        }, 15000);

        // Abort if the client disconnects
        const abortSignal = request.signal;
        abortSignal?.addEventListener("abort", () => {
          try { clearInterval(heartbeat); } catch {}
          try { controller.close(); } catch {}
        });

        (async function pump() {
          try {
            let buffer = "";
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });

              let idx;
              while ((idx = buffer.indexOf("\n")) >= 0) {
                const line = buffer.slice(0, idx).trimEnd();
                buffer = buffer.slice(idx + 1);
                if (!line.startsWith("data: ")) continue;

                const json = line.slice(6).trim();
                if (!json || json === "[DONE]") continue;

                try {
                  const chunk = JSON.parse(json);

                  // forward only text deltas as token events
                  if (chunk.type === "response.output_text.delta") {
                    const delta = chunk.delta || "";
                    sendEvent("token", { content: delta });
                  }

                  // You can forward other events as needed (tool calls, etc.)
                } catch {
                  // ignore parse errors
                }
              }
            }

            // Send metadata (sources + context) as a single SSE event
            sendEvent("metadata", { sources, context: contextText });

            // Signal completion
            sendEvent("done", {});

            try { clearInterval(heartbeat); } catch {}
            controller.close();
          } catch (e) {
            try { clearInterval(heartbeat); } catch {}
            controller.error(e);
          }
        })();
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Optional but handy for browser clients:
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
