import {craftKnowledge,tradeGroups} from './trades.js';
import { services, roundMoney, radicalBlocked, validISODate } from './core.js';
import { normalizeSpeech, parseGermanNumber } from './speech.js';

const KB_SOURCE_URL='https://www.landkreis-kronach.de/media/22639/information-kompostplatze-2025.pdf';
export const LOCAL_REGION=Object.freeze({
  base:'96268 Mitwitz',region:'Bayern',serviceAreas:Object.freeze(['Kronach','Sonnefeld','Stockheim','Gundelsdorf']),verifiedAt:'2026-10-08',
  disposal:Object.freeze({commercialRateNet:9,invoiceFeeNet:5,sourceDate:'2025-01',sourceURL:KB_SOURCE_URL,volumeUnit:'m³',commercialFreeAllowance:0,
    provider:Object.freeze({name:'Kompostplatz Horb/Steinach',operator:'Horst Barnickel',address:'Horb 12, 96268 Mitwitz',phone:'0170 315 89 89'}),
    excludedMaterials:Object.freeze(['Äste mit mehr als 10 cm Durchmesser','Baumstämme','Wurzelstöcke mit mehr als 10 cm Durchmesser','Verunreinigtes Grüngut und Fremdstoffe']),
    caveat:'Veröffentlichter Stand Januar 2025, zuletzt am 08.10.2026 geprüft. Aktuellen Tarif, gewerbliche Annahme, Benutzerordnung und Öffnung vor Anlieferung bestätigen. Keine belegte Mindestmenge oder Aufrundung je angefangenem Kubikmeter.'})
});

export const SITE_CHECKS=Object.freeze([
  Object.freeze({key:'siteInspected',label:'Aufmaß, Zustand und Zugang vor Ort geprüft'}),
  Object.freeze({key:'qualifiedWorkers',label:'Für die geplante Ausführung qualifizierte Personen eingeplant'}),
  Object.freeze({key:'permissionsChecked',label:'Baumschutz, Artenschutz, Genehmigungen und Zugangsrechte geklärt'}),
  Object.freeze({key:'safetyPlanConfirmed',label:'Sichere Erreichbarkeit, Absicherung und benötigte Spezialtechnik geprüft'})
]);

const KB_CATALOG={
  lawn:{summary:'Regelmäßiges Rasenmähen mit vereinbarter Schnitthöhe, Kantenpflege und sauberem Abschluss.',
    questions:['Wie groß ist die tatsächlich zu mähende Fläche, und wie viel davon ist freie Rasenfläche?','Wie hoch und dicht ist der Rasen; gibt es Steigungen, Hindernisse oder nasse Stellen?','Mulchen oder Schnittgut aufnehmen? Sind Kantenarbeit und Entsorgung enthalten?','Wie breit ist der Zugang und in welchem Abstand soll der Rasen gepflegt werden?'],
    risks:['Fremdkörper, empfindliche Einbauten und Kabel vor Beginn prüfen.','Feuchtigkeit, Überwuchs und Hanglagen können Gerät und Zeitbedarf verändern.'],
    pricingBasis:'Bestätigte m² × vereinbarter Preis; Kanten, Überwuchs, Fahrt, Rüsten und Schnittgut ausdrücklich einordnen.',
    offerNotes:['Schnittgutaufnahme und Entsorgung getrennt vom bloßen Mähen benennen.','Wetterbedingte Terminverschiebung und vereinbarte Pflegeintervalle festhalten.']},
  hedge:{summary:'Schonender Pflegeschnitt einer vorhandenen Hecke; er unterscheidet sich vom starken Rückschnitt bis ins alte Holz.',
    questions:['Wie lang, hoch und breit ist die Hecke, und welche Seiten werden geschnitten?','Welche Pflanzenart und welcher Schnittzustand liegen vor?','Sind Oberseite und Rückseite sicher erreichbar; wird eine besondere Zugangstechnik benötigt?','Wie viel Grünschnitt fällt an und wer übernimmt Abtransport und Entsorgung?'],
    risks:['Nester und Artenschutz vor Ort prüfen, auch bei zulässigem Pflegeschnitt.','Ein normaler Meterpreis umfasst keine beliebige Heckenhöhe oder erschwerte Zugänglichkeit.'],
    pricingBasis:'Bestätigte laufende Meter mit dokumentierter Höhe, Seitenzahl und Zugänglichkeit; Zusatzaufwand gesondert.',
    offerNotes:['Schnittumfang als laufende Pflege und gewünschte Endform schriftlich beschreiben.','Starker Rückschnitt wird gesondert als Radikalschnitt geprüft und angeboten.']},
  radical:{summary:'Starker Heckenrückschnitt oder Auf-den-Stock-Setzen erfordert eine andere Zeit-, Schutz- und Entsorgungsplanung als laufende Pflege.',
    questions:['Welche Gehölze werden wie weit zurückgenommen und auf welche Endhöhe?','Ist der geplante Zeitraum nach § 39 BNatSchG zulässig und sind örtliche Schutzregeln geprüft?','Sind Nester, andere geschützte Tiere oder besondere Bestände vorhanden?','Sind Zugang, Aststärken, loses Grünschnittvolumen und Annahmestelle geklärt?'],
    risks:['Grundsätzlich keine radikalen Heckenschnitte vom 1. März bis 30. September; rechtliche Einzelfälle und Artenschutz gesondert prüfen.','Dicke Äste, Baumstämme und größere Wurzelstöcke passen nicht pauschal in den Kronacher Grünguttarif.'],
    pricingBasis:'Bestätigte laufende Meter, Höhe, Breite und Schnittstärke; Abtransport, Gebühren und Sondertechnik separat.',
    offerNotes:['Zulässigen Ausführungszeitraum und Schnittgrenzen festhalten.','Keine automatische Gleichsetzung mit schonendem Formschnitt.']},
  shape:{summary:'Kontrollierter Formschnitt nach vereinbarter Kontur; aufwendige Figuren benötigen eine eigene Zeitbewertung.',
    questions:['Welche Form und welche Endmaße wünscht der Kunde?','Wie hoch und breit sind die Pflanzen und wie dicht ist die Krone?','Welche Flächen und Seiten sind erreichbar; ist eine Probefläche sinnvoll?','Welche Qualitätsabnahme und Grünschnittentsorgung werden vereinbart?'],
    risks:['Starker Eingriff ins alte Holz kann rechtlich und fachlich ein anderer Auftrag sein.','Artenschutz und Nester auch bei Formschnitten prüfen.'],
    pricingBasis:'Laufende Meter nur bei vergleichbarer Geometrie; komplexe Einzelpflanzen und Figuren nach bestätigtem Zeitumfang.',
    offerNotes:['Formziel, Endmaße und mögliche pflanzliche Grenzen beschreiben.','Schnittgutaufnahme und Abtransport als eigenen Umfang nennen.']},
  weeds:{summary:'Mechanische Unkrautentfernung auf Beeten, Fugen und befestigten Flächen nach geprüftem Untergrund.',
    questions:['Wie groß und stark bewachsen ist die Fläche?','Beet, Fuge, Kies oder Pflaster; sollen Wurzeln entfernt werden?','Sind empfindliche Pflanzen, Beschichtungen, Einbauten oder Leitungen betroffen?','Wie werden Rückstände entsorgt und ist wiederkehrende Pflege gewünscht?'],
    risks:['Untergrund und erwünschte Pflanzen können durch ungeeignete Werkzeuge beschädigt werden.','Pflanzenschutzmittel nicht pauschal für Wege oder versiegelte Flächen anbieten; Zulässigkeit und Sachkunde gesondert prüfen.'],
    pricingBasis:'Bestätigte m², Befallsgrad, Wurzeltiefe und Untergrund; Zeitvergleich an einer Probefläche.',
    offerNotes:['Mechanisches Verfahren und Pflegeumfang nennen.','Keine dauerhafte Unkrautfreiheit ohne vereinbarte Folgepflege versprechen.']},
  landscape:{summary:'Vereinbarte laufende Garten- und Landschaftspflege wie Beetpflege, Laubaufnahme und einfache Pflanzenpflege.',
    questions:['Welche einzelnen Flächen und Pflegeleistungen werden beauftragt?','Welche Pflanzen, Bodenarten und jahreszeitlichen Arbeiten sind betroffen?','Sind Material, Mulch, Wasser, Zugang und Lagerflächen vorhanden?','Welche Aufgaben sind regelmäßig und welche einmalig; gibt es Baum-, Bau- oder Spezialarbeiten?'],
    risks:['Neuanlage, Erdarbeiten, Fällung, Pflanzenschutz und Spezialtechnik gehören nicht automatisch zu allgemeiner Pflege.','Ein Stundenansatz ersetzt keine klare Leistungsbeschreibung oder Materialplanung.'],
    pricingBasis:'Bestätigte Personenstunden oder klar abgegrenzte Einzelleistungen; Material, Transport und Entsorgung getrennt.',
    offerNotes:['Pflegeplan, Leistungsgrenzen und Rhythmus vereinbaren.','Zusatzleistungen nur nach Abstimmung kalkulieren.']},
  tree:{summary:'Einfacher Baumpflegerückschnitt an sicher vom Boden erreichbaren Bereichen; keine Fällung und keine Kletter- oder Motorsägenleistung.',
    questions:['Welche Baumart, Höhe, Kronengröße und welches Schnittziel liegen vor?','Welche Aststärken und Schäden sind vorhanden?','Sind sämtliche beauftragten Bereiche sicher vom Boden erreichbar?','Sind Artenschutz, örtliche Baumschutzregeln und Schnittgutentsorgung geklärt?'],
    risks:['Eine Baumzahl allein beschreibt weder Aufwand noch sichere Ausführbarkeit.','Kletterarbeit, Hubarbeitsbühne, Motorsäge oder Arbeiten über Gebäuden benötigen gesonderte fachkundige Planung.'],
    pricingBasis:'Bestätigter einzelner Baum mit dokumentiertem Pflegeumfang; zusätzliche Personen und Spezialtechnik gesondert.',
    offerNotes:['Sicher vom Boden erreichbaren Pflegeumfang ausdrücklich eingrenzen.','Fällung, Stubbenentfernung und größere Spezialarbeiten separat anbieten.']},
  felling:{summary:'Baumfällung als geprüfter Einzelauftrag mit qualifizierten Personen, geklärten Schutzregeln und dokumentierter Absicherung.',
    questions:['Welche Höhe, welchen Stammdurchmesser, Kronenumfang und Zustand hat jeder Baum?','Wie ist der Zugang und welche Gebäude, Straßen, Nachbarflächen oder Leitungen liegen im Arbeitsbereich?','Welche Genehmigungen, Baumschutz- und Artenschutzprüfungen sind erforderlich und bereits geklärt?','Welche qualifizierten Personen und welche geeignete Spezialtechnik werden nach Vor-Ort-Prüfung benötigt?','Wer übernimmt Holz, Stammteile, Grünschnitt, Wurzelstock und die getrennte Entsorgung?'],
    risks:['Ohne Vor-Ort-Prüfung ist ein Baum-Pauschalpreis kein verlässliches verbindliches Angebot.','Sturmgeschädigte, geschwächte oder schwer zugängliche Bäume erfordern eine gesonderte fachkundige Beurteilung.','Baumstämme werden laut Kronacher Kompostplatzinformation nicht angenommen; dicke Äste und größere Wurzelstöcke ebenfalls gesondert klären.'],
    pricingBasis:'Jeden Baum nach tatsächlichen Maßen, Zustand, Zugang, Sicherung und benötigter Technik bewerten; kein automatisch recherchierter Marktpreis.',
    offerNotes:['Anzahl und Merkmale jedes Baums, erforderliche Technik und personelle Besetzung angeben.','Holzverbleib, Stubbenarbeiten, Abtransport und getrennte Gebühren ausdrücklich vereinbaren.','Ausführung nur durch dafür qualifizierte Personen nach Schutz- und Sicherheitsprüfung.']},
  greenhaul:{summary:'Verladen und Abtransport von bestätigtem losem Grünschnittvolumen; Transportleistung und Annahmegebühr sind eigene Positionen.',
    questions:['Wie viele lose m³ fallen tatsächlich an; ist das Volumen vor Ort bestätigt?','Ist das Material sauber und frei von Baumstämmen, zu dicken Ästen, größeren Wurzelstöcken und Fremdstoffen?','Wie sind Verladezugang, zulässige Nutzlast, Fahrzeug und Zahl der nötigen Fahrten?','Welche Stelle nimmt die gewerbliche Anlieferung an und welcher Tarif gilt zum Termin?'],
    risks:['Die Privat-Freimenge bis 5 m³ ist keine automatische Gewerbe-Freimenge.','Volumen allein ergibt weder Gewicht, Anhänger-Nutzlast noch Fahrtenzahl.','Kronacher Tarifstand Januar 2025 muss vor Verwendung aktuell bestätigt werden.'],
    pricingBasis:'Bestätigte lose m³ für Verladen/Transport; tatsächliche Personenzeit, Fahrt und belegte Gebühren separat ohne Doppelzählung.',
    offerNotes:['Transport, Verladung und Entsorgungsgebühr getrennt beschreiben.','Holz oder nicht angenommenes Material nach eigener Annahmebestätigung separat kalkulieren.']},
  home:{summary:'Regelmäßige Haushaltsreinigung der vereinbarten zugänglichen Wohnbereiche.',
    questions:['Welche tatsächlich zugängliche Wohnfläche und wie viele Küchen und Bäder werden gereinigt?','Welche Oberflächen und Bodenbeläge, Verschmutzungen, Tiere oder Allergien sind zu beachten?','Ist Aufräumen, Wäsche, Geschirr oder Innenreinigung von Schränken ausdrücklich enthalten?','Welcher Rhythmus, Zugang, Schlüsselumgang und Materialeinsatz sind vereinbart?'],
    risks:['Aufräumen und stark verschmutzte Sonderbereiche verändern die kalkulierte Reinigungszeit.','Farbcodierte Materialien und getrennte Sanitär-/Küchentücher verwenden; Mittel materialgerecht auswählen.'],
    pricingBasis:'Zugängliche m², Raum- und Sanitäranzahl, Rhythmus und tatsächliche Zeit; Zusatzarbeiten einzeln.',
    offerNotes:['Raumliste und enthaltene Tätigkeiten festhalten.','Fenster, Grundreinigung und Haushaltshilfe nicht unbemerkt in einen normalen m²-Preis aufnehmen.']},
  house:{summary:'Hausreinigung nach Leistungsverzeichnis einschließlich der ausdrücklich beauftragten Räume und Zugänge.',
    questions:['Welche Räume, Etagen und Nebengebäude gehören dazu?','Welche Küchen, Bäder, Möbel, Materialien und Flächen sind zugänglich?','Sind Fenster, Treppen, Keller, Außenbereiche oder Grundreinigung zusätzliche Leistungen?','Welcher Zustand, Zeitraum, Schlüsselzugang und Abnahmeumfang sind vereinbart?'],
    risks:['Bewohnte, leer stehende und stark verschmutzte Häuser haben unterschiedliche Zeitbedarfe.','Außenfassaden, Schimmel, Gefahrstoffe oder Spezialreinigung separat fachkundig prüfen.'],
    pricingBasis:'Bestätigte zugängliche m² und konkretes Raum-/Leistungsverzeichnis; Sanitäranzahl und Möblierung berücksichtigen.',
    offerNotes:['Enthaltene Räume und Zusatzflächen eindeutig nennen.','Fenster, Teppich- und Sonderreinigung als eigene Positionen bewerten.']},
  deep:{summary:'Intensive Grundreinigung nach Material-, Belags- und Fleckenprüfung; die Methode wird nicht pauschal aus einem Foto abgeleitet.',
    questions:['Welcher Bodenbelag, welche Beschichtung und welche Oberflächen liegen vor?','Welche Fläche, Verschmutzung, Flecken und vorhandenen Pflegeprodukte sind betroffen?','Ist eine Materialprobe bzw. unauffällige Probefläche geprüft und welche Maschine ist geeignet?','Sind Strom, Wasser, Möbelräumung, Trocknungszeit und anschließende Nutzung geklärt?'],
    risks:['Ungeeignete Reiniger, Dosierung oder Maschinen können empfindliche Materialien und Beschichtungen schädigen.','Schimmel, biologische Belastungen oder Gefahrstoffe benötigen eine gesonderte Beurteilung und keine normale Grundreinigungszusage.'],
    pricingBasis:'Bestätigte m², Belag, Verschmutzungsgrad und Probeflächen-Zeit; Maschinenmiete und Verbrauch offen ausweisen.',
    offerNotes:['Behandelte Materialien, Verfahren und vereinbarte Abnahme dokumentieren.','Möbelräumung, Beschichtung und Trocknungs-/Sperrzeiten gesondert vereinbaren.']},
  window:{summary:'Glas- und Fensterreinigung mit eindeutigem Flächenmaß und sicherer Erreichbarkeit.',
    questions:['Welche Glasfläche wird gereinigt und sind Innen- und Außenseite enthalten?','Sind Rahmen, Falze, Fensterbänke, Sprossen oder Beschattungen eingeschlossen?','Welche Verschmutzung und Glasbeschichtung liegen vor?','Sind alle Fenster sicher erreichbar; ist besondere Zugangstechnik erforderlich?'],
    risks:['Anzahl der Fenster ersetzt kein verlässliches Glasflächenmaß.','Arbeiten mit Absturzrisiko und schwer erreichbare Außenflächen nicht im Standardpreis verstecken.','Beschichtungen, Folien und empfindliche Rahmen vor aggressiven Mitteln prüfen.'],
    pricingBasis:'Bestätigte m² Glasfläche nach festgelegter Zählweise für die vereinbarten Seiten; Zugang und Rahmenumfang ergänzen.',
    offerNotes:['Zählweise der Glasfläche und enthaltene Seiten festhalten.','Rahmen, Falze und benötigte Zugangstechnik gesondert benennen.']},
  stairs:{summary:'Treppenhausreinigung nach vereinbartem Etagen-, Podest- und Eingangsbereich.',
    questions:['Wie viele Etagen, Podeste, Treppenläufe und Eingänge gehören zum Auftrag?','Sind Handläufe, Fenster, Aufzug, Keller oder Briefkästen enthalten?','Welcher Belag und welche Verschmutzung liegen vor?','Wie werden Publikumsverkehr, nasse Flächen, Zugang und Reinigungszeiten organisiert?'],
    risks:['Eine Etage kann je nach Gebäude eine sehr unterschiedliche Fläche und Zeit bedeuten.','Rutschgefahr, Verkehrswege und Warnkennzeichnung einplanen.'],
    pricingBasis:'Bestätigte Etagen mit definiertem Treppen-/Podestumfang oder Fläche; Aufzug und große Eingänge separat.',
    offerNotes:['Wiederholungsrhythmus und konkretes Leistungsverzeichnis angeben.','Fenster, Aufzug und zusätzliche Flächen klar von den normalen Etagen unterscheiden.']},
  office:{summary:'Büroreinigung nach abgestimmten Arbeits-, Sanitär- und Nebenbereichen sowie Zugangs- und Datenschutzregeln.',
    questions:['Wie viele m², Arbeitsplätze, Sanitärbereiche und Teeküchen werden gereinigt?','Welche Bodenarten und Oberflächen, Abfälle und besonderen Bereiche liegen vor?','Wie sind Arbeitszeiten, Alarmanlage, Schlüssel und vertrauliche Unterlagen geregelt?','Welcher Rhythmus und welche Verbrauchsmaterialversorgung sind beauftragt?'],
    risks:['Vertrauliche Dokumente und Technik nur im vereinbarten Umfang behandeln.','Sanitärlast und Arbeitsplatzdichte beeinflussen den Zeitbedarf stärker als die Gesamtfläche allein.'],
    pricingBasis:'Bestätigte m² mit Raum-/Leistungsverzeichnis, Arbeitsplatz- und Sanitäranzahl; Pflegeintervall berücksichtigen.',
    offerNotes:['Reinigungszeiten, Schlüssel-/Alarmablauf und Datenschutzabsprachen dokumentieren.','Papierprodukte und sonstige Verbrauchsgüter gesondert vereinbaren.']},
  practice:{summary:'Praxisreinigung nach dem konkreten Hygieneplan und Freigaben der Praxis, mit geschulten Personen und dokumentierter Durchführung.',
    questions:['Welche Räume, Risikobereiche, Flächen und m² umfasst der Praxisauftrag?','Welcher verbindliche Hygieneplan und welche freigegebenen Mittel gelten?','Welche Dosierung, Einwirkzeit, Dokumentation und Unterweisung gibt die Praxis vor?','Welche Materialien, farbcodierten Systeme, Schutzmittel und Zeiten sind vorgesehen?'],
    risks:['Kein allgemeines Desinfektions- oder Hygieneversprechen aus einem normalen Flächenpreis ableiten.','Instrumentenaufbereitung, infektiöse Abfälle und Spezialbereiche sind keine automatische Praxisreinigungsleistung.','Mittel, Einwirkzeiten und Verantwortung mit der Praxis und qualifizierten Personen abstimmen.'],
    pricingBasis:'Bestätigte m² und konkreter Hygiene-/Leistungsplan; Risikobereiche, Dokumentation und geschulte Ausführung berücksichtigen.',
    offerNotes:['Hygieneplan-Version, freigegebene Verfahren und dokumentierten Umfang benennen.','Instrumente, medizinische Spezialaufgaben und besondere Abfälle ausdrücklich separat behandeln.']}
};

export function knowledgeFor(serviceId){
  const service=services.find(item=>item.id===serviceId),knowledge=KB_CATALOG[serviceId]||craftKnowledge(serviceId);
  if(!service||!knowledge)return null;
  return {serviceId,name:service.name,category:service.category,unit:service.unit,...structuredClone(knowledge),equipment:[...service.equipment],tasks:[...service.tasks],sources:serviceId==='greenhaul'||serviceId==='felling'||serviceId==='radical'?[{url:KB_SOURCE_URL,title:'Kompostplätze im Landkreis Kronach',sourceDate:'2025-01'}]:[],scopeNote:'Lokaler Fachkatalog zur Vorbereitung. Er ersetzt weder Vor-Ort-Prüfung, Qualifikation, verbindliche Freigaben noch einen vollständig geprüften Einzelfall.'};
}

function kbMeasures(raw){
  const text=normalizeSpeech(raw).replace(/kubik\s+meter/g,'kubikmeter').replace(/zenti\s+meter/g,'zentimeter').replace(/(\d)(cm|zentimeter|kubikmeter|m3)\b/g,'$1 $2');
  const results=[],units=/\b(kubikmeter|m3|zentimeter|cm|meter|m)\b/g;let match;
  while((match=units.exec(text))){
    const before=text.slice(0,match.index).trimEnd(),tokens=before.split(/\s+/);let value=null,start=match.index;
    for(let length=Math.min(9,tokens.length);length>=1;length--){const candidate=tokens.slice(-length).join(' '),number=parseGermanNumber(candidate);if(number!==null){value=number;start=before.length-candidate.length;break;}}
    if(value===null)continue;
    results.push({value,unit:match[1],start,end:match.index+match[0].length,prefix:text.slice(Math.max(0,start-100),start).trimEnd(),suffix:text.slice(match.index+match[0].length,match.index+match[0].length+100),range:/\b(?:bis|zwischen|oder)\s*$/.test(text.slice(Math.max(0,start-20),start))});
  }
  return {text,results};
}

/** Units: height metres, trunk diameter centimetres, loose green waste cubic metres. */
export function parseSiteDetails(raw){
  const {text,results}=kbMeasures(raw),output={},values={treeHeight:[],trunkDiameter:[],greenVolume:[]},uncertain=new Set();
  for(const measure of results){
    const {value,unit,prefix,suffix}=measure;let key=null,converted=value;
    const diameterBefore=/\b(?:stammdurchmesser|stammstaerke|stamm|durchmesser|bhd)(?:\s+(?:ist|hat|von|des|der|baum(?:es)?|stamm(?:es)?|betraegt|ca|circa|etwa|rund))*\s*$/.test(prefix),diameterAfter=/^\s*(?:stammdurchmesser|stammstaerke|durchmesser|bhd)\b/.test(suffix);
    if(['cm','zentimeter','meter','m'].includes(unit)&&(diameterBefore||diameterAfter)){key='trunkDiameter';if(['meter','m'].includes(unit))converted=value*100;}
    else if(['meter','m'].includes(unit)&&(/\b(?:baumhoehe|hoehe)(?:\s+(?:ist|von|der|des|baum(?:es)?|baeume|betraegt|ca|circa|etwa|rund))*\s*$/.test(prefix)||/^\s*(?:hoch|hoehe|hohe(?:r|n|s)?)\b/.test(suffix)))key='treeHeight';
    else if(['kubikmeter','m3'].includes(unit)&&!(/\b(?:wasser|raum|raumvolumen|hausvolumen)\b[^.]*$/.test(prefix)&&!/(?:gruenschnitt|schnittgut|abtransport)/.test(prefix))){
      key='greenVolume';
      if(/\b(?:baumstaemme|stammholz|wurzelstoecke|wurzelstock|bauholz|altholz)\b/.test(prefix+' '+suffix)){uncertain.add(key);continue;}
    }
    if(!key)continue;
    const max={treeHeight:100,trunkDiameter:500,greenVolume:10000}[key];
    if(measure.range||!Number.isFinite(converted)||converted<=0||converted>max){uncertain.add(key);continue;}
    values[key].push(roundMoney(converted));
  }
  for(const [key,numbers]of Object.entries(values)){const distinct=[...new Set(numbers)];if(distinct.length===1&&!uncertain.has(key))output[key]=distinct[0];else if(distinct.length>1)uncertain.add(key);}
  if(/\b(?:zugang|zufahrt|erreichbarkeit)\s*(?:ist|:|-)?\s*(?:nicht\s+bekannt|unklar|unbekannt|offen)\b/.test(text))output.access='unknown';
  else if(/\b(?:kein(?:e|en)?\s+(?:zugang|zufahrt)|(?:zugang|zufahrt)\s*(?:ist|:|-)?\s*(?:nicht\s+moeglich|unmoeglich|schwierig|sehr\s+eng)|schwer\s+zugaenglich)\b/.test(text))output.access='difficult';
  else if(/\b(?:schmal(?:er|e|en)?\s+(?:zugang|zufahrt)|eingeschraenkt(?:er|e)?\s+(?:zugang|zufahrt)|(?:zugang|zufahrt)\s*(?:ist|:|-)?\s*(?:schmal|eng|eingeschraenkt|begrenzt)|nur\s+(?:zu\s+fuss|ueber\s+treppen))\b/.test(text))output.access='limited';
  else if(/\b(?:(?:zugang|zufahrt)\s*(?:ist|:|-)?\s*(?:gut|frei|breit|ebenerdig|problemlos)|(?:gut|frei|leicht|ebenerdig)\s+zugaenglich|freie\s+zufahrt)\b/.test(text))output.access='easy';
  if(uncertain.size)output.uncertain=[...uncertain];
  return output;
}

function kbValidMeasurement(value,max){return typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=max;}
export function assessSite(job,details={}){
  details=details&&typeof details==='object'&&!Array.isArray(details)?details:{};
  const missing=[],warnings=[],lines=Array.isArray(job?.lines)?job.lines:[],serviceIds=[...new Set(lines.map(line=>line?.service))];
  const addMissing=value=>{if(!missing.includes(value))missing.push(value);},addWarning=value=>{if(!warnings.includes(value))warnings.push(value);};
  if(!lines.length)addMissing('Leistungsumfang und bestätigte Mengen');
  for(const line of lines){if(!knowledgeFor(line?.service)||!Number.isFinite(line?.qty)||line.qty<=0)addMissing('Gültige Leistung und bestätigte Menge');if(!Number.isFinite(line?.rate)||line.rate<0)addMissing('Vereinbarten Leistungspreis bestätigen');}
  if((job?.resources||[]).some(r=>r.use)&&(job.resourceCostsApplied!==true||(job.resources||[]).some(r=>r.use&&r.costConfirmed!==true)))addMissing('Material- und Maschinenplan mit bestätigten Kosten übernehmen');
  if(details.uncertain?.length)addWarning('Mehrere, unklare oder außerhalb des Planungsbereichs liegende Maße erkannt. Maße je Objekt vor Ort bestätigen.');
  const crafts=serviceIds.map(id=>services.find(s=>s.id===id)).filter(s=>s&&tradeGroups.some(g=>g.id===s.category)&&s.id!=='customwork');
  if(crafts.length){if(details.siteInspected!==true)addMissing('Aufmaß, Untergrund und Leistungsumfang vor Ort geprüft');addWarning('Materialverträglichkeit, Herstellerangaben und tatsächliche Verbrauchs-/Zeitwerte für diesen Auftrag bestätigen.');}
  if(crafts.some(s=>['electrical','building_services','roofing','demolition','metal','masonry'].includes(s.category))){if(details.qualifiedWorkers!==true)addMissing('Erforderliche fachliche Qualifikation bestätigt');if(details.safetyPlanConfirmed!==true)addMissing('Ausführung und Sicherheitsplanung fachkundig bestätigt');}
  if(crafts.some(s=>['electrical','building_services','roofing','demolition','masonry'].includes(s.category))&&details.permissionsChecked!==true)addMissing('Erforderliche Freigaben und Zulassungen geprüft');
  if(serviceIds.includes('felling')){
    if(!kbValidMeasurement(details.treeHeight,100))addMissing('Baumhöhe in Metern');
    if(!kbValidMeasurement(details.trunkDiameter,500))addMissing('Stammdurchmesser in Zentimetern');
    if(!['easy','limited','difficult'].includes(details.access))addMissing('Zugang und Zufahrt');
    for(const check of SITE_CHECKS)if(details[check.key]!==true)addMissing(check.label);
    if(lines.filter(line=>line?.service==='felling').reduce((sum,line)=>sum+(Number(line.qty)||0),0)>1)addWarning('Für mehrere Bäume muss die Vor-Ort-Prüfung jeden Baum erfassen; ein gemeinsamer Maßwert allein bestätigt keine identischen Bedingungen.');
    addWarning('Baumstämme, Äste über 10 cm und Wurzelstöcke über 10 cm separat entsorgen; dafür gilt keine automatisch berechnete Grüngutgebühr.');
    if(validISODate(job.date)&&Number(job.date.slice(5,7))>=3&&Number(job.date.slice(5,7))<=9)addWarning('Fällung in der Vegetationszeit: örtlichen Baumschutz, anwendbare Schutzfristen und Artenschutz für diesen Standort fachkundig klären.');
  }
  if(serviceIds.includes('greenhaul')){
    if(!kbValidMeasurement(details.greenVolume,10000))addMissing('Bestätigtes loses Grünschnittvolumen in m³');
    if(!['easy','limited','difficult'].includes(details.access))addMissing('Verladezugang und Zufahrt');
    if(details.siteInspected!==true)addMissing('Grünschnittmenge, Material und Verladezugang vor Ort geprüft');
    addWarning('Gewerbliche Annahme und aktuellen Tarif vor Anlieferung bestätigen. Verladung, Fahrt und Gebühr getrennt kalkulieren.');
  }
  if(serviceIds.includes('tree')){
    if(!kbValidMeasurement(details.treeHeight,100))addMissing('Baumhöhe und Umfang des Pflegerückschnitts');
    if(!['easy','limited','difficult'].includes(details.access))addMissing('Sichere Erreichbarkeit vom Boden');
    if(details.siteInspected!==true||details.safetyPlanConfirmed!==true)addMissing('Sicher vom Boden erreichbaren Pflegeumfang vor Ort bestätigen');
    if(/\b(?:klettern|kletterarbeit|hubarbeitsbuehne|motorsaege|faellen|faellung)\b/.test(normalizeSpeech(job.notes||''))){addMissing('Spezialarbeit als getrennten fachkundig geprüften Auftrag abgrenzen');addWarning('Einfacher Baumpflegerückschnitt umfasst keine Fällung, Kletter-, Bühnen- oder Motorsägenarbeiten.');}
  }
  if(serviceIds.includes('radical')){
    if(!validISODate(job.date))addMissing('Zulässigen Ausführungstermin für den Radikalschnitt');
    else if(radicalBlocked(job)){addMissing('Radikalschnitt-Termin außerhalb der grundsätzlichen Sperrzeit');addWarning('Radikaler Heckenschnitt ist grundsätzlich vom 1. März bis 30. September gesperrt.');}
    if(details.permissionsChecked!==true)addMissing('Zeitraum, Artenschutz und örtliche Schutzregeln geprüft');
  }
  if(serviceIds.includes('deep')){if(details.siteInspected!==true)addMissing('Material, Belag und geeignete Probefläche vor Ort prüfen');addWarning('Materialverträglichkeit und Maschinenverfahren bestätigen; Foto und Fläche allein bestimmen kein sicheres Grundreinigungsverfahren.');}
  if(serviceIds.includes('window')){if(details.siteInspected!==true||details.safetyPlanConfirmed!==true)addMissing('Glasflächen, Seitenumfang und sichere Erreichbarkeit bestätigen');addWarning('Schwer erreichbare Fenster und besondere Zugangstechnik gesondert kalkulieren.');}
  if(serviceIds.includes('practice')){if(details.siteInspected!==true||details.qualifiedWorkers!==true)addMissing('Hygiene-/Leistungsplan mit der Praxis und geschulten Personen abstimmen');addWarning('Die App bestätigt keinen Hygieneplan und keine Instrumentenaufbereitung. Freigaben, Verfahren und Dokumentation mit der Praxis vereinbaren.');}
  if(['limited','difficult'].includes(details.access))addWarning('Erschwerter Zugang kann zusätzliche Personen, Fahrten oder Spezialtechnik erfordern. Tatsächlichen Aufwand gesondert bestätigen.');
  return {missing,warnings,readyForBindingQuote:missing.length===0};
}

/** Commercial Kronach estimate; caller supplies confirmed loose volume, never tree count. */
export function disposalEstimate(volume,{taxMode='small',vatRate=19,volumeConfirmed=true,woodIncluded=false}={}){
  if(!kbValidMeasurement(volume,10000))throw Error('Bitte ein bestätigtes loses Grünschnittvolumen größer als 0 und bis 10.000 m³ eingeben. Eine Baumzahl ersetzt kein Volumen.');
  if(volumeConfirmed!==true)throw Error('Das lose Grünschnittvolumen zuerst vor Ort bestätigen.');
  if(woodIncluded)throw Error('Baumstämme, Äste über 10 cm und Wurzelstöcke über 10 cm benötigen eine gesondert bestätigte Entsorgung. Dafür ist der Grünguttarif nicht anwendbar.');
  if(!['small','standard','exempt'].includes(taxMode))throw Error('Bitte einen gültigen Steuermodus wählen.');
  if(typeof vatRate!=='number'||!Number.isFinite(vatRate)||vatRate<0||vatRate>100)throw Error('Bitte einen gültigen Umsatzsteuersatz der Annahmestelle eingeben.');
  const volumeCostNet=roundMoney(volume*LOCAL_REGION.disposal.commercialRateNet),invoiceFeeNet=LOCAL_REGION.disposal.invoiceFeeNet,net=roundMoney(volumeCostNet+invoiceFeeNet),vat=roundMoney(net*vatRate/100),gross=roundMoney(net+vat);
  return {volume,volumeCostNet,invoiceFeeNet,net,vatRate,vat,gross,cost:taxMode==='standard'?net:gross,taxMode,sourceURL:KB_SOURCE_URL,sourceDate:LOCAL_REGION.disposal.sourceDate,verifiedAt:LOCAL_REGION.verifiedAt,
    caveat:`Gewerblicher Planungswert: 9 €/m³ plus einmal 5 € Rechnungspauschale netto, hier mit ${vatRate} % Lieferanten-Umsatzsteuer gerechnet. Nur bestätigtes loses, annahmefähiges Grüngut; keine private Freimenge. Kein belegtes Aufrunden auf ganze m³. Tarifstand Januar 2025 vor Verwendung bestätigen. Verladung, Transport, Holzentsorgung und weitere Rechnungspauschalen bei tatsächlich getrennten Rechnungen sind nicht enthalten. Vorsteuerabzug bei Regelbesteuerung nur bei tatsächlicher Berechtigung.`};
}
