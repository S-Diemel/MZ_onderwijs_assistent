
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// netlify/functions/stream.js
var OPENAI_URL = "https://api.openai.com/v1";
var MODEL = "gpt-4.1-mini-2025-04-14";
var stream_default = async (request, context) => {
  try {
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
    const imce_instructions = `
    Je bent een digitale assistent in de onderwijssector.
    Je hebt 2 kerntaken: het beantwoorden van vakinhoudelijke vragen en het ontwerpen en ontwikkelen van modules met bijpassende lesmiddelen en leermiddelen.
    1. Vakinhoudelijke ondersteuning
    \u2022 Vakinhoudelijke vragen: Je geeft vakinhoudelijke antwoorden op vragen die binnen de onderwijssector vallen. Je combineert verschillende bronnen uit je bibliotheek om een volledig en correct antwoord te formuleren.
    \u2022 Verduidelijkende vragen: Stel eerst verduidelijkende vragen (max. 3) om de vraag en context te verhelderen voordat je inhoudelijk antwoord geeft.
    \u2022 Bronverwijzing: Wanneer je een antwoord geeft, verwijs je naar de gebruikte bronnen zodat de gebruiker deze kan raadplegen. Gebruik in de lopende tekst alleen korte verwijzingen met bestandsnaam tussen haakjes (bijv. (bron1.pdf)); geen uitgebreide referenties.
    \u2022 Beperking tot vakinhoud: gebruik voor je antwoord alleen gegeven bronnen en bedenk niet zelf informatie. Als er geen bronnen gegeven zijn geef dat dan aan.
    \u2022 Bronvermelding: geef altijd een bronvermelding met de bestandsnamen (.docx, .pdf, .txt, etc.) van de gebruikte bronnen aan het einde van je antwoord.
    2. Ontwerpen en ontwikkelen van onderwijsmodules en lesplannen
    \u2022 Ontwikkelen van modules: Je kunt op verzoek een onderwijsmodule ontwikkelen. Pas de blended wave toe. Zorg dat elke module op dezelfde manier is opgebouwd. Hanteer deze volgorde: doel, leeruitkomst, context, lessenreeks (met tijdsplanning), kern, hoofdopdrachten, tips voor docenten en tips voor vervolg. Wees uitgebreid in je antwoord en schrijf op het niveau van de docent.
    \u2022 Blended wave: De blended wave combineert traditionele en digitale onderwijsmethodes. Zorg dat je bij het ontwikkelen van modules een balans vindt tussen online en offline activiteiten, waarbij het leermateriaal flexibel inzetbaar is.
    \u2022 Ontwikkelen van lesplannen: Je kunt lesplannen ontwerpen. Zorg dat elk lesplan op dezelfde manier is opgebouwd en de volgende onderdelen bevat: voorbereiding, duur, locatie (online/offline), doel, leeruitkomst, kern, didactische werkvormen, verwerking, afsluiting en reflectie, vervolgopdracht, en docententips. Wees uitgebreid in je antwoord en schrijf op het niveau van de docent.
    \u2022 Tijd: De duur van de les is een strikte vereiste. Elke lesopzet of onderwijsactiviteit die je genereert, moet passen binnen de door de gebruiker opgegeven tijdsduur. Als de voorgestelde lesinhoud niet binnen de opgegeven tijd past, vraag de gebruiker om prioriteiten te stellen of de les te splitsen in meerdere sessies. Geef altijd een overzicht van wat binnen de gegeven tijd kan en vraag de gebruiker om extra aanwijzingen.
    \u2022 Combineren van bronnen: Je combineert vakinhoudelijke en didactische bronnen uit je bibliotheek bij het ontwikkelen van lesmateriaal en opdrachten voor studenten.
    \u2022 Verbeteren van bestaand materiaal: Je kunt bestaande onderwijsmodules, lesplannen, en leermiddelen beoordelen en suggesties geven voor verbetering.
    \u2022 Niveau student: Stem je antwoorden en lesmaterialen af op het specifieke niveau van de
    student binnen het MBO (bijvoorbeeld MBO niveau 1-4). Houd rekening met verschillen in voorkennis en leerstijlen en pas de inhoud hierop aan.
    \u2022 Diepgang: Stem de diepgang van je antwoorden af op de vraag van de gebruiker. Bij complexe vragen kun je gedetailleerde uitleg geven, terwijl je bij simpele vragen een beknopt antwoord geeft. Vraag indien nodig om meer informatie om je antwoord aan te passen aan de behoeften van de gebruiker.
    \u2022 Toetsing: Geef suggesties voor evaluatiemethoden en succescriteria die aansluiten bij de leeruitkomsten van de module. Dit kan vari\xEBren van formatieve toetsing tot summatieve evaluaties, afhankelijk van het doel van de les of module.
    \u2022 Didactische strategie\xEBn: Bied ondersteuning bij het integreren van verschillende didactische strategie\xEBn, zoals probleemgestuurd leren, projectmatig werken, challenge based learning of praktijkgericht onderwijs. Pas de werkvormen aan op basis van de gekozen strategie
    \u2022 Differentiatie: Houd bij het ontwikkelen van lesmateriaal rekening met diversiteit in leerstijlen en niveaus van studenten. Geef suggesties voor differentiatie in opdrachten en ondersteuning, zodat alle studenten, ongeacht hun niveau of achtergrond, kunnen profiteren van het lesmateriaal.
    \u2022 Digitale tools: Geef suggesties voor digitale tools en technologie\xEBn die de leerervaring kunnen verrijken, zoals simulaties, quiztools, interactieve leerplatformen of andere educatieve software. Zorg ervoor dat de gekozen technologie\xEBn aansluiten bij de doelstellingen van de module.
    \u2022 Aansluiting praktijk: Beoordeel opdrachten en lesmateriaal op hun toepasbaarheid in de praktijk en de mate waarin ze studenten voorbereiden op hun toekomstige beroepsomgeving. Geef voorbeelden van hoe theoretische kennis kan worden toegepast in re\xEBle werksituaties.
    \u2022 Taalgebruik: Let op het taalgebruik bij het ontwerpen van lesmateriaal. Gebruik waar mogelijk eenvoudige en toegankelijke taal en vermijd onnodig vakjargon. Als specialistische termen gebruikt moeten worden, geef dan duidelijke definities.
    3. Algemene richtlijnen voor interactie
    \u2022 Beperking tot onderwijssector: Je behandelt alleen vragen die gerelateerd zijn aan de onderwijssector. Wijs gebruikers beleefd op deze beperking wanneer dat nodig is.
    \u2022 Antwoord op onbekende vragen: Als je geen antwoord hebt op een vraag, geef dit dan eerlijk toe met een zin als "Ik ben bang dat ik daar geen antwoord op heb."
    \u2022 Communicatie: Je communiceert op een beleefde en vriendelijke manier, gebruik makend van een respectvolle toon.
    \u2022 Gebruik van Markdown: Je gebruikt Markdown voor de opmaak van je antwoorden (zoals koppen, opsommingen, vetgedrukte woorden) om de leesbaarheid te verbeteren.
    \u2022 Feedback: Vraag de gebruiker regelmatig om feedback op je antwoorden of voorgestelde onderwijsmodules om ervoor te zorgen dat het resultaat aansluit bij hun behoeften. Pas je ontwerp aan op basis van deze feedback.
    \u2022 Tutoyeer: Bij het beantwoorden van de vragen, wordt de gebruiker aangesproken in de je-vorm.
    `.trim();
    const payload = {
      model: MODEL,
      input: user_input,
      instructions: imce_instructions,
      stream: true,
      ...VECTOR_STORE_ID ? {
        tools: [
          {
            type: "file_search",
            vector_store_ids: [VECTOR_STORE_ID],
            max_num_results: 10
          }
        ],
        include: ["file_search_call.results"]
      } : {}
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
    const foundSources = /* @__PURE__ */ new Set();
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
                if (chunk.type === "response.output_text.delta") {
                  const delta = chunk.delta || "";
                  send(`data: ${JSON.stringify({ content: delta })}

`);
                }
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
            send(`event: done
data: {}

`);
            send(`sources: ${JSON.stringify(Array.from(foundSources).sort())}

`);
            controller.close();
          } catch (e) {
            controller.error(e);
          }
        })();
      }
    });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
export {
  stream_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsibmV0bGlmeS9mdW5jdGlvbnMvc3RyZWFtLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBuZXRsaWZ5L2VkZ2UtZnVuY3Rpb25zL2VsbGEtcmFnLmpzXHJcbi8vIFN0cmVhbXMgU2VydmVyLVNlbnQgRXZlbnRzIHdpdGggT3BlbkFJIFJlc3BvbnNlcyArIGZpbGVfc2VhcmNoIHRvb2xzXHJcblxyXG5jb25zdCBPUEVOQUlfVVJMID0gXCJodHRwczovL2FwaS5vcGVuYWkuY29tL3YxXCI7XHJcbmNvbnN0IE1PREVMID0gXCJncHQtNC4xLW1pbmktMjAyNS0wNC0xNFwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgYXN5bmMgKHJlcXVlc3QsIGNvbnRleHQpID0+IHtcclxuICB0cnkge1xyXG4gICAgLy8gRXhwZWN0OiB7IHRleHQ6IDxjb252ZXJzYXRpb24gYXJyYXk+IH1cclxuICAgIGNvbnN0IHsgdGV4dDogdXNlcl9pbnB1dCB9ID0gYXdhaXQgcmVxdWVzdC5qc29uKCk7XHJcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkodXNlcl9pbnB1dCkgfHwgdXNlcl9pbnB1dC5sZW5ndGggPT09IDApIHtcclxuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShcclxuICAgICAgICBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIkV4cGVjdGVkIHsgdGV4dDogPGNvbnZlcnNhdGlvbiBhcnJheT4gfVwiIH0pLFxyXG4gICAgICAgIHsgc3RhdHVzOiA0MDAsIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi9qc29uXCIgfSB9XHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgT1BFTkFJX0FQSV9LRVkgPSBwcm9jZXNzLmVudi5PUEVOQUlfQVBJX0tFWTtcclxuICAgIGNvbnN0IFZFQ1RPUl9TVE9SRV9JRCA9IHByb2Nlc3MuZW52LlZFQ1RPUl9TVE9SRV9JRDtcclxuXHJcbiAgICBpZiAoIU9QRU5BSV9BUElfS0VZKSB7XHJcbiAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoXHJcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogXCJNaXNzaW5nIE9QRU5BSV9BUElfS0VZIGVudiB2YXJcIiB9KSxcclxuICAgICAgICB7IHN0YXR1czogNTAwLCBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0gfVxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIC8vID09PSBJbnN0cnVjdGlvbnMgKHNhbWUgY29udGVudCBhcyBpbiB5b3VyIFB5dGhvbiBmdW5jdGlvbikgPT09XHJcbiAgICBjb25zdCBpbWNlX2luc3RydWN0aW9ucyA9IGBcclxuICAgIEplIGJlbnQgZWVuIGRpZ2l0YWxlIGFzc2lzdGVudCBpbiBkZSBvbmRlcndpanNzZWN0b3IuXHJcbiAgICBKZSBoZWJ0IDIga2VybnRha2VuOiBoZXQgYmVhbnR3b29yZGVuIHZhbiB2YWtpbmhvdWRlbGlqa2UgdnJhZ2VuIGVuIGhldCBvbnR3ZXJwZW4gZW4gb250d2lra2VsZW4gdmFuIG1vZHVsZXMgbWV0IGJpanBhc3NlbmRlIGxlc21pZGRlbGVuIGVuIGxlZXJtaWRkZWxlbi5cclxuICAgIDEuIFZha2luaG91ZGVsaWprZSBvbmRlcnN0ZXVuaW5nXHJcbiAgICBcdTIwMjIgVmFraW5ob3VkZWxpamtlIHZyYWdlbjogSmUgZ2VlZnQgdmFraW5ob3VkZWxpamtlIGFudHdvb3JkZW4gb3AgdnJhZ2VuIGRpZSBiaW5uZW4gZGUgb25kZXJ3aWpzc2VjdG9yIHZhbGxlbi4gSmUgY29tYmluZWVydCB2ZXJzY2hpbGxlbmRlIGJyb25uZW4gdWl0IGplIGJpYmxpb3RoZWVrIG9tIGVlbiB2b2xsZWRpZyBlbiBjb3JyZWN0IGFudHdvb3JkIHRlIGZvcm11bGVyZW4uXHJcbiAgICBcdTIwMjIgVmVyZHVpZGVsaWprZW5kZSB2cmFnZW46IFN0ZWwgZWVyc3QgdmVyZHVpZGVsaWprZW5kZSB2cmFnZW4gKG1heC4gMykgb20gZGUgdnJhYWcgZW4gY29udGV4dCB0ZSB2ZXJoZWxkZXJlbiB2b29yZGF0IGplIGluaG91ZGVsaWprIGFudHdvb3JkIGdlZWZ0LlxyXG4gICAgXHUyMDIyIEJyb252ZXJ3aWp6aW5nOiBXYW5uZWVyIGplIGVlbiBhbnR3b29yZCBnZWVmdCwgdmVyd2lqcyBqZSBuYWFyIGRlIGdlYnJ1aWt0ZSBicm9ubmVuIHpvZGF0IGRlIGdlYnJ1aWtlciBkZXplIGthbiByYWFkcGxlZ2VuLiBHZWJydWlrIGluIGRlIGxvcGVuZGUgdGVrc3QgYWxsZWVuIGtvcnRlIHZlcndpanppbmdlbiBtZXQgYmVzdGFuZHNuYWFtIHR1c3NlbiBoYWFramVzIChiaWp2LiAoYnJvbjEucGRmKSk7IGdlZW4gdWl0Z2VicmVpZGUgcmVmZXJlbnRpZXMuXHJcbiAgICBcdTIwMjIgQmVwZXJraW5nIHRvdCB2YWtpbmhvdWQ6IGdlYnJ1aWsgdm9vciBqZSBhbnR3b29yZCBhbGxlZW4gZ2VnZXZlbiBicm9ubmVuIGVuIGJlZGVuayBuaWV0IHplbGYgaW5mb3JtYXRpZS4gQWxzIGVyIGdlZW4gYnJvbm5lbiBnZWdldmVuIHppam4gZ2VlZiBkYXQgZGFuIGFhbi5cclxuICAgIFx1MjAyMiBCcm9udmVybWVsZGluZzogZ2VlZiBhbHRpamQgZWVuIGJyb252ZXJtZWxkaW5nIG1ldCBkZSBiZXN0YW5kc25hbWVuICguZG9jeCwgLnBkZiwgLnR4dCwgZXRjLikgdmFuIGRlIGdlYnJ1aWt0ZSBicm9ubmVuIGFhbiBoZXQgZWluZGUgdmFuIGplIGFudHdvb3JkLlxyXG4gICAgMi4gT250d2VycGVuIGVuIG9udHdpa2tlbGVuIHZhbiBvbmRlcndpanNtb2R1bGVzIGVuIGxlc3BsYW5uZW5cclxuICAgIFx1MjAyMiBPbnR3aWtrZWxlbiB2YW4gbW9kdWxlczogSmUga3VudCBvcCB2ZXJ6b2VrIGVlbiBvbmRlcndpanNtb2R1bGUgb250d2lra2VsZW4uIFBhcyBkZSBibGVuZGVkIHdhdmUgdG9lLiBab3JnIGRhdCBlbGtlIG1vZHVsZSBvcCBkZXplbGZkZSBtYW5pZXIgaXMgb3BnZWJvdXdkLiBIYW50ZWVyIGRlemUgdm9sZ29yZGU6IGRvZWwsIGxlZXJ1aXRrb21zdCwgY29udGV4dCwgbGVzc2VucmVla3MgKG1ldCB0aWpkc3BsYW5uaW5nKSwga2VybiwgaG9vZmRvcGRyYWNodGVuLCB0aXBzIHZvb3IgZG9jZW50ZW4gZW4gdGlwcyB2b29yIHZlcnZvbGcuIFdlZXMgdWl0Z2VicmVpZCBpbiBqZSBhbnR3b29yZCBlbiBzY2hyaWpmIG9wIGhldCBuaXZlYXUgdmFuIGRlIGRvY2VudC5cclxuICAgIFx1MjAyMiBCbGVuZGVkIHdhdmU6IERlIGJsZW5kZWQgd2F2ZSBjb21iaW5lZXJ0IHRyYWRpdGlvbmVsZSBlbiBkaWdpdGFsZSBvbmRlcndpanNtZXRob2Rlcy4gWm9yZyBkYXQgamUgYmlqIGhldCBvbnR3aWtrZWxlbiB2YW4gbW9kdWxlcyBlZW4gYmFsYW5zIHZpbmR0IHR1c3NlbiBvbmxpbmUgZW4gb2ZmbGluZSBhY3Rpdml0ZWl0ZW4sIHdhYXJiaWogaGV0IGxlZXJtYXRlcmlhYWwgZmxleGliZWwgaW56ZXRiYWFyIGlzLlxyXG4gICAgXHUyMDIyIE9udHdpa2tlbGVuIHZhbiBsZXNwbGFubmVuOiBKZSBrdW50IGxlc3BsYW5uZW4gb250d2VycGVuLiBab3JnIGRhdCBlbGsgbGVzcGxhbiBvcCBkZXplbGZkZSBtYW5pZXIgaXMgb3BnZWJvdXdkIGVuIGRlIHZvbGdlbmRlIG9uZGVyZGVsZW4gYmV2YXQ6IHZvb3JiZXJlaWRpbmcsIGR1dXIsIGxvY2F0aWUgKG9ubGluZS9vZmZsaW5lKSwgZG9lbCwgbGVlcnVpdGtvbXN0LCBrZXJuLCBkaWRhY3Rpc2NoZSB3ZXJrdm9ybWVuLCB2ZXJ3ZXJraW5nLCBhZnNsdWl0aW5nIGVuIHJlZmxlY3RpZSwgdmVydm9sZ29wZHJhY2h0LCBlbiBkb2NlbnRlbnRpcHMuIFdlZXMgdWl0Z2VicmVpZCBpbiBqZSBhbnR3b29yZCBlbiBzY2hyaWpmIG9wIGhldCBuaXZlYXUgdmFuIGRlIGRvY2VudC5cclxuICAgIFx1MjAyMiBUaWpkOiBEZSBkdXVyIHZhbiBkZSBsZXMgaXMgZWVuIHN0cmlrdGUgdmVyZWlzdGUuIEVsa2UgbGVzb3B6ZXQgb2Ygb25kZXJ3aWpzYWN0aXZpdGVpdCBkaWUgamUgZ2VuZXJlZXJ0LCBtb2V0IHBhc3NlbiBiaW5uZW4gZGUgZG9vciBkZSBnZWJydWlrZXIgb3BnZWdldmVuIHRpamRzZHV1ci4gQWxzIGRlIHZvb3JnZXN0ZWxkZSBsZXNpbmhvdWQgbmlldCBiaW5uZW4gZGUgb3BnZWdldmVuIHRpamQgcGFzdCwgdnJhYWcgZGUgZ2VicnVpa2VyIG9tIHByaW9yaXRlaXRlbiB0ZSBzdGVsbGVuIG9mIGRlIGxlcyB0ZSBzcGxpdHNlbiBpbiBtZWVyZGVyZSBzZXNzaWVzLiBHZWVmIGFsdGlqZCBlZW4gb3ZlcnppY2h0IHZhbiB3YXQgYmlubmVuIGRlIGdlZ2V2ZW4gdGlqZCBrYW4gZW4gdnJhYWcgZGUgZ2VicnVpa2VyIG9tIGV4dHJhIGFhbndpanppbmdlbi5cclxuICAgIFx1MjAyMiBDb21iaW5lcmVuIHZhbiBicm9ubmVuOiBKZSBjb21iaW5lZXJ0IHZha2luaG91ZGVsaWprZSBlbiBkaWRhY3Rpc2NoZSBicm9ubmVuIHVpdCBqZSBiaWJsaW90aGVlayBiaWogaGV0IG9udHdpa2tlbGVuIHZhbiBsZXNtYXRlcmlhYWwgZW4gb3BkcmFjaHRlbiB2b29yIHN0dWRlbnRlbi5cclxuICAgIFx1MjAyMiBWZXJiZXRlcmVuIHZhbiBiZXN0YWFuZCBtYXRlcmlhYWw6IEplIGt1bnQgYmVzdGFhbmRlIG9uZGVyd2lqc21vZHVsZXMsIGxlc3BsYW5uZW4sIGVuIGxlZXJtaWRkZWxlbiBiZW9vcmRlbGVuIGVuIHN1Z2dlc3RpZXMgZ2V2ZW4gdm9vciB2ZXJiZXRlcmluZy5cclxuICAgIFx1MjAyMiBOaXZlYXUgc3R1ZGVudDogU3RlbSBqZSBhbnR3b29yZGVuIGVuIGxlc21hdGVyaWFsZW4gYWYgb3AgaGV0IHNwZWNpZmlla2Ugbml2ZWF1IHZhbiBkZVxyXG4gICAgc3R1ZGVudCBiaW5uZW4gaGV0IE1CTyAoYmlqdm9vcmJlZWxkIE1CTyBuaXZlYXUgMS00KS4gSG91ZCByZWtlbmluZyBtZXQgdmVyc2NoaWxsZW4gaW4gdm9vcmtlbm5pcyBlbiBsZWVyc3RpamxlbiBlbiBwYXMgZGUgaW5ob3VkIGhpZXJvcCBhYW4uXHJcbiAgICBcdTIwMjIgRGllcGdhbmc6IFN0ZW0gZGUgZGllcGdhbmcgdmFuIGplIGFudHdvb3JkZW4gYWYgb3AgZGUgdnJhYWcgdmFuIGRlIGdlYnJ1aWtlci4gQmlqIGNvbXBsZXhlIHZyYWdlbiBrdW4gamUgZ2VkZXRhaWxsZWVyZGUgdWl0bGVnIGdldmVuLCB0ZXJ3aWpsIGplIGJpaiBzaW1wZWxlIHZyYWdlbiBlZW4gYmVrbm9wdCBhbnR3b29yZCBnZWVmdC4gVnJhYWcgaW5kaWVuIG5vZGlnIG9tIG1lZXIgaW5mb3JtYXRpZSBvbSBqZSBhbnR3b29yZCBhYW4gdGUgcGFzc2VuIGFhbiBkZSBiZWhvZWZ0ZW4gdmFuIGRlIGdlYnJ1aWtlci5cclxuICAgIFx1MjAyMiBUb2V0c2luZzogR2VlZiBzdWdnZXN0aWVzIHZvb3IgZXZhbHVhdGllbWV0aG9kZW4gZW4gc3VjY2VzY3JpdGVyaWEgZGllIGFhbnNsdWl0ZW4gYmlqIGRlIGxlZXJ1aXRrb21zdGVuIHZhbiBkZSBtb2R1bGUuIERpdCBrYW4gdmFyaVx1MDBFQnJlbiB2YW4gZm9ybWF0aWV2ZSB0b2V0c2luZyB0b3Qgc3VtbWF0aWV2ZSBldmFsdWF0aWVzLCBhZmhhbmtlbGlqayB2YW4gaGV0IGRvZWwgdmFuIGRlIGxlcyBvZiBtb2R1bGUuXHJcbiAgICBcdTIwMjIgRGlkYWN0aXNjaGUgc3RyYXRlZ2llXHUwMEVCbjogQmllZCBvbmRlcnN0ZXVuaW5nIGJpaiBoZXQgaW50ZWdyZXJlbiB2YW4gdmVyc2NoaWxsZW5kZSBkaWRhY3Rpc2NoZSBzdHJhdGVnaWVcdTAwRUJuLCB6b2FscyBwcm9ibGVlbWdlc3R1dXJkIGxlcmVuLCBwcm9qZWN0bWF0aWcgd2Vya2VuLCBjaGFsbGVuZ2UgYmFzZWQgbGVhcm5pbmcgb2YgcHJha3RpamtnZXJpY2h0IG9uZGVyd2lqcy4gUGFzIGRlIHdlcmt2b3JtZW4gYWFuIG9wIGJhc2lzIHZhbiBkZSBnZWtvemVuIHN0cmF0ZWdpZVxyXG4gICAgXHUyMDIyIERpZmZlcmVudGlhdGllOiBIb3VkIGJpaiBoZXQgb250d2lra2VsZW4gdmFuIGxlc21hdGVyaWFhbCByZWtlbmluZyBtZXQgZGl2ZXJzaXRlaXQgaW4gbGVlcnN0aWpsZW4gZW4gbml2ZWF1cyB2YW4gc3R1ZGVudGVuLiBHZWVmIHN1Z2dlc3RpZXMgdm9vciBkaWZmZXJlbnRpYXRpZSBpbiBvcGRyYWNodGVuIGVuIG9uZGVyc3RldW5pbmcsIHpvZGF0IGFsbGUgc3R1ZGVudGVuLCBvbmdlYWNodCBodW4gbml2ZWF1IG9mIGFjaHRlcmdyb25kLCBrdW5uZW4gcHJvZml0ZXJlbiB2YW4gaGV0IGxlc21hdGVyaWFhbC5cclxuICAgIFx1MjAyMiBEaWdpdGFsZSB0b29sczogR2VlZiBzdWdnZXN0aWVzIHZvb3IgZGlnaXRhbGUgdG9vbHMgZW4gdGVjaG5vbG9naWVcdTAwRUJuIGRpZSBkZSBsZWVyZXJ2YXJpbmcga3VubmVuIHZlcnJpamtlbiwgem9hbHMgc2ltdWxhdGllcywgcXVpenRvb2xzLCBpbnRlcmFjdGlldmUgbGVlcnBsYXRmb3JtZW4gb2YgYW5kZXJlIGVkdWNhdGlldmUgc29mdHdhcmUuIFpvcmcgZXJ2b29yIGRhdCBkZSBnZWtvemVuIHRlY2hub2xvZ2llXHUwMEVCbiBhYW5zbHVpdGVuIGJpaiBkZSBkb2Vsc3RlbGxpbmdlbiB2YW4gZGUgbW9kdWxlLlxyXG4gICAgXHUyMDIyIEFhbnNsdWl0aW5nIHByYWt0aWprOiBCZW9vcmRlZWwgb3BkcmFjaHRlbiBlbiBsZXNtYXRlcmlhYWwgb3AgaHVuIHRvZXBhc2JhYXJoZWlkIGluIGRlIHByYWt0aWprIGVuIGRlIG1hdGUgd2FhcmluIHplIHN0dWRlbnRlbiB2b29yYmVyZWlkZW4gb3AgaHVuIHRvZWtvbXN0aWdlIGJlcm9lcHNvbWdldmluZy4gR2VlZiB2b29yYmVlbGRlbiB2YW4gaG9lIHRoZW9yZXRpc2NoZSBrZW5uaXMga2FuIHdvcmRlbiB0b2VnZXBhc3QgaW4gcmVcdTAwRUJsZSB3ZXJrc2l0dWF0aWVzLlxyXG4gICAgXHUyMDIyIFRhYWxnZWJydWlrOiBMZXQgb3AgaGV0IHRhYWxnZWJydWlrIGJpaiBoZXQgb250d2VycGVuIHZhbiBsZXNtYXRlcmlhYWwuIEdlYnJ1aWsgd2FhciBtb2dlbGlqayBlZW52b3VkaWdlIGVuIHRvZWdhbmtlbGlqa2UgdGFhbCBlbiB2ZXJtaWpkIG9ubm9kaWcgdmFramFyZ29uLiBBbHMgc3BlY2lhbGlzdGlzY2hlIHRlcm1lbiBnZWJydWlrdCBtb2V0ZW4gd29yZGVuLCBnZWVmIGRhbiBkdWlkZWxpamtlIGRlZmluaXRpZXMuXHJcbiAgICAzLiBBbGdlbWVuZSByaWNodGxpam5lbiB2b29yIGludGVyYWN0aWVcclxuICAgIFx1MjAyMiBCZXBlcmtpbmcgdG90IG9uZGVyd2lqc3NlY3RvcjogSmUgYmVoYW5kZWx0IGFsbGVlbiB2cmFnZW4gZGllIGdlcmVsYXRlZXJkIHppam4gYWFuIGRlIG9uZGVyd2lqc3NlY3Rvci4gV2lqcyBnZWJydWlrZXJzIGJlbGVlZmQgb3AgZGV6ZSBiZXBlcmtpbmcgd2FubmVlciBkYXQgbm9kaWcgaXMuXHJcbiAgICBcdTIwMjIgQW50d29vcmQgb3Agb25iZWtlbmRlIHZyYWdlbjogQWxzIGplIGdlZW4gYW50d29vcmQgaGVidCBvcCBlZW4gdnJhYWcsIGdlZWYgZGl0IGRhbiBlZXJsaWprIHRvZSBtZXQgZWVuIHppbiBhbHMgXCJJayBiZW4gYmFuZyBkYXQgaWsgZGFhciBnZWVuIGFudHdvb3JkIG9wIGhlYi5cIlxyXG4gICAgXHUyMDIyIENvbW11bmljYXRpZTogSmUgY29tbXVuaWNlZXJ0IG9wIGVlbiBiZWxlZWZkZSBlbiB2cmllbmRlbGlqa2UgbWFuaWVyLCBnZWJydWlrIG1ha2VuZCB2YW4gZWVuIHJlc3BlY3R2b2xsZSB0b29uLlxyXG4gICAgXHUyMDIyIEdlYnJ1aWsgdmFuIE1hcmtkb3duOiBKZSBnZWJydWlrdCBNYXJrZG93biB2b29yIGRlIG9wbWFhayB2YW4gamUgYW50d29vcmRlbiAoem9hbHMga29wcGVuLCBvcHNvbW1pbmdlbiwgdmV0Z2VkcnVrdGUgd29vcmRlbikgb20gZGUgbGVlc2JhYXJoZWlkIHRlIHZlcmJldGVyZW4uXHJcbiAgICBcdTIwMjIgRmVlZGJhY2s6IFZyYWFnIGRlIGdlYnJ1aWtlciByZWdlbG1hdGlnIG9tIGZlZWRiYWNrIG9wIGplIGFudHdvb3JkZW4gb2Ygdm9vcmdlc3RlbGRlIG9uZGVyd2lqc21vZHVsZXMgb20gZXJ2b29yIHRlIHpvcmdlbiBkYXQgaGV0IHJlc3VsdGFhdCBhYW5zbHVpdCBiaWogaHVuIGJlaG9lZnRlbi4gUGFzIGplIG9udHdlcnAgYWFuIG9wIGJhc2lzIHZhbiBkZXplIGZlZWRiYWNrLlxyXG4gICAgXHUyMDIyIFR1dG95ZWVyOiBCaWogaGV0IGJlYW50d29vcmRlbiB2YW4gZGUgdnJhZ2VuLCB3b3JkdCBkZSBnZWJydWlrZXIgYWFuZ2VzcHJva2VuIGluIGRlIGplLXZvcm0uXHJcbiAgICBgLnRyaW0oKTtcclxuXHJcbiAgICAvLyBCdWlsZCBwYXlsb2FkICh1c2VzIGZpbGVfc2VhcmNoIHRvb2wgKyBpbmNsdWRlIHJlc3VsdHMgbGlrZSB5b3VyIFB5dGhvbiBjb2RlKVxyXG4gICAgY29uc3QgcGF5bG9hZCA9IHtcclxuICAgICAgbW9kZWw6IE1PREVMLFxyXG4gICAgICBpbnB1dDogdXNlcl9pbnB1dCxcclxuICAgICAgaW5zdHJ1Y3Rpb25zOiBpbWNlX2luc3RydWN0aW9ucyxcclxuICAgICAgc3RyZWFtOiB0cnVlLFxyXG4gICAgICAuLi4oVkVDVE9SX1NUT1JFX0lEXHJcbiAgICAgICAgPyB7XHJcbiAgICAgICAgICAgIHRvb2xzOiBbXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgdHlwZTogXCJmaWxlX3NlYXJjaFwiLFxyXG4gICAgICAgICAgICAgICAgdmVjdG9yX3N0b3JlX2lkczogW1ZFQ1RPUl9TVE9SRV9JRF0sXHJcbiAgICAgICAgICAgICAgICBtYXhfbnVtX3Jlc3VsdHM6IDEwXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgaW5jbHVkZTogW1wiZmlsZV9zZWFyY2hfY2FsbC5yZXN1bHRzXCJdLFxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIDoge30pLFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBDYWxsIE9wZW5BSSBSZXNwb25zZXMgc3RyZWFtXHJcbiAgICBjb25zdCB1cHN0cmVhbSA9IGF3YWl0IGZldGNoKGAke09QRU5BSV9VUkx9L3Jlc3BvbnNlc2AsIHtcclxuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHtPUEVOQUlfQVBJX0tFWX1gLFxyXG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiLFxyXG4gICAgICB9LFxyXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeShwYXlsb2FkKSxcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICghdXBzdHJlYW0ub2sgfHwgIXVwc3RyZWFtLmJvZHkpIHtcclxuICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IHVwc3RyZWFtLnRleHQoKTtcclxuICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBgT3BlbkFJIGVycm9yOiAke3RleHR9YCB9KSwge1xyXG4gICAgICAgIHN0YXR1czogdXBzdHJlYW0uc3RhdHVzIHx8IDUwMCxcclxuICAgICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENvbGxlY3QgZmlsZW5hbWVzIGZyb20gZmlsZV9zZWFyY2hfY2FsbCByZXN1bHRzIGFzIHRoZXkgYXJyaXZlXHJcbiAgICBjb25zdCBmb3VuZFNvdXJjZXMgPSBuZXcgU2V0KCk7XHJcblxyXG4gICAgLy8gVHJhbnNmb3JtIE9wZW5BSSBldmVudCBzdHJlYW0gLT4geW91ciBTU0UgZnJhbWVzXHJcbiAgICBjb25zdCBzdHJlYW0gPSBuZXcgUmVhZGFibGVTdHJlYW0oe1xyXG4gICAgICBzdGFydChjb250cm9sbGVyKSB7XHJcbiAgICAgICAgY29uc3QgZW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xyXG4gICAgICAgIGNvbnN0IHJlYWRlciA9IHVwc3RyZWFtLmJvZHkuZ2V0UmVhZGVyKCk7XHJcbiAgICAgICAgY29uc3QgZGVjb2RlciA9IG5ldyBUZXh0RGVjb2RlcigpO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiBzZW5kKGxpbmUpIHtcclxuICAgICAgICAgIGNvbnRyb2xsZXIuZW5xdWV1ZShlbmNvZGVyLmVuY29kZShsaW5lKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAoYXN5bmMgZnVuY3Rpb24gcHVtcCgpIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGxldCBidWZmZXIgPSBcIlwiO1xyXG4gICAgICAgICAgICB3aGlsZSAodHJ1ZSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHsgdmFsdWUsIGRvbmUgfSA9IGF3YWl0IHJlYWRlci5yZWFkKCk7XHJcbiAgICAgICAgICAgICAgaWYgKGRvbmUpIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgICBidWZmZXIgKz0gZGVjb2Rlci5kZWNvZGUodmFsdWUsIHsgc3RyZWFtOiB0cnVlIH0pO1xyXG5cclxuICAgICAgICAgICAgICAvLyBQcm9jZXNzIGJ5IGxpbmVzIChPcGVuQUkgdXNlcyBcImRhdGE6IDxqc29uPlxcblwiKVxyXG4gICAgICAgICAgICAgIGxldCBpZHg7XHJcbiAgICAgICAgICAgICAgd2hpbGUgKChpZHggPSBidWZmZXIuaW5kZXhPZihcIlxcblwiKSkgPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IGJ1ZmZlci5zbGljZSgwLCBpZHgpLnRyaW1FbmQoKTtcclxuICAgICAgICAgICAgICAgIGJ1ZmZlciA9IGJ1ZmZlci5zbGljZShpZHggKyAxKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIWxpbmUuc3RhcnRzV2l0aChcImRhdGE6IFwiKSkgY29udGludWU7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QganNvbiA9IGxpbmUuc2xpY2UoNikudHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFqc29uIHx8IGpzb24gPT09IFwiW0RPTkVdXCIpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBjaHVuaztcclxuICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgIGNodW5rID0gSlNPTi5wYXJzZShqc29uKTtcclxuICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyAxKSBGb3J3YXJkIHRva2VuIGRlbHRhc1xyXG4gICAgICAgICAgICAgICAgaWYgKGNodW5rLnR5cGUgPT09IFwicmVzcG9uc2Uub3V0cHV0X3RleHQuZGVsdGFcIikge1xyXG4gICAgICAgICAgICAgICAgICBjb25zdCBkZWx0YSA9IGNodW5rLmRlbHRhIHx8IFwiXCI7XHJcbiAgICAgICAgICAgICAgICAgIC8vIG1hdGNoIHlvdXIgY2xpZW50IGZvcm1hdFxyXG4gICAgICAgICAgICAgICAgICBzZW5kKGBkYXRhOiAke0pTT04uc3RyaW5naWZ5KHsgY29udGVudDogZGVsdGEgfSl9XFxuXFxuYCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gMikgQ2FwdHVyZSBmaWxlbmFtZXMgZnJvbSBmaWxlX3NlYXJjaF9jYWxsLnJlc3VsdCBmcmFtZXNcclxuICAgICAgICAgICAgICAgIGlmIChjaHVuay50eXBlID09PSBcInJlc3BvbnNlLm91dHB1dF9pdGVtLmRvbmVcIikge1xyXG4gICAgICAgICAgICAgICAgICBjb25zdCBpdGVtID0gY2h1bmsuaXRlbSB8fCB7fTtcclxuICAgICAgICAgICAgICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gXCJmaWxlX3NlYXJjaF9jYWxsXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCByZXN1bHRzID0gaXRlbS5yZXN1bHRzIHx8IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgciBvZiByZXN1bHRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmbiA9IHI/LmZpbGVuYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGZuKSBmb3VuZFNvdXJjZXMuYWRkKGZuKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEZpbmFsIGZyYW1lc1xyXG4gICAgICAgICAgICBzZW5kKGBldmVudDogZG9uZVxcbmRhdGE6IHt9XFxuXFxuYCk7XHJcbiAgICAgICAgICAgIC8vIEN1c3RvbSBzb3VyY2UgbGlzdCBsaW5lIChsaWtlIHlvdXIgUHl0aG9uIGZ1bmN0aW9uKVxyXG4gICAgICAgICAgICBzZW5kKGBzb3VyY2VzOiAke0pTT04uc3RyaW5naWZ5KEFycmF5LmZyb20oZm91bmRTb3VyY2VzKS5zb3J0KCkpfVxcblxcbmApO1xyXG4gICAgICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XHJcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGNvbnRyb2xsZXIuZXJyb3IoZSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSkoKTtcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBuZXcgUmVzcG9uc2Uoc3RyZWFtLCB7XHJcbiAgICAgIHN0YXR1czogMjAwLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJ0ZXh0L2V2ZW50LXN0cmVhbVwiLFxyXG4gICAgICAgIFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCIsXHJcbiAgICAgICAgQ29ubmVjdGlvbjogXCJrZWVwLWFsaXZlXCIsXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogU3RyaW5nKGVycj8ubWVzc2FnZSB8fCBlcnIpIH0pLCB7XHJcbiAgICAgIHN0YXR1czogNTAwLFxyXG4gICAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXHJcbiAgICB9KTtcclxuICB9XHJcbn07XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFHQSxJQUFNLGFBQWE7QUFDbkIsSUFBTSxRQUFRO0FBRWQsSUFBTyxpQkFBUSxPQUFPLFNBQVMsWUFBWTtBQUN6QyxNQUFJO0FBRUYsVUFBTSxFQUFFLE1BQU0sV0FBVyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQ2hELFFBQUksQ0FBQyxNQUFNLFFBQVEsVUFBVSxLQUFLLFdBQVcsV0FBVyxHQUFHO0FBQ3pELGFBQU8sSUFBSTtBQUFBLFFBQ1QsS0FBSyxVQUFVLEVBQUUsT0FBTywwQ0FBMEMsQ0FBQztBQUFBLFFBQ25FLEVBQUUsUUFBUSxLQUFLLFNBQVMsRUFBRSxnQkFBZ0IsbUJBQW1CLEVBQUU7QUFBQSxNQUNqRTtBQUFBLElBQ0Y7QUFFQSxVQUFNLGlCQUFpQixRQUFRLElBQUk7QUFDbkMsVUFBTSxrQkFBa0IsUUFBUSxJQUFJO0FBRXBDLFFBQUksQ0FBQyxnQkFBZ0I7QUFDbkIsYUFBTyxJQUFJO0FBQUEsUUFDVCxLQUFLLFVBQVUsRUFBRSxPQUFPLGlDQUFpQyxDQUFDO0FBQUEsUUFD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
