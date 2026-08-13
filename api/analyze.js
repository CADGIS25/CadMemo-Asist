export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'Cheia GEMINI_API_KEY nu este configurată în Vercel.' });
        }

        const { base64Data, mimeType, filename } = req.body;

        if (!base64Data) {
            return res.status(400).json({ error: 'Lipsesc datele din fișierul transmis.' });
        }

        const systemPrompt = `
Ești un Inspector Virtual de elită și expert în Cadastru și Drept Imobiliar din România, numit CadMemo-Asist.
Analizează documentul transmis (PAD, Act de Proprietate, Certificat Fiscal, Sentință sau Referat OCPI) prin prisma întregului cadru legal din România:
- Ordinul ANCPI nr. 600/2023 (Toleranțe tehnice, regeometrizări, actualizări);
- Legea Cadastrului nr. 7/1996 (în special Art. 37 alin. 6 privitor la construcțiile pre-2001 și intabulare);
- Codul Civil (Art. 888 - Titluri autentice notariale/judecătorești, uzucapiune, accesiune);
- Legea nr. 50/1991 și Codul de Procedură Fiscală.

Extrage datele relevante și returnează un răspuns EXCLUSIV în format JSON valid, fără alt text în jur, respectând strict această structură:
{
  "date_teren": {
    "suprafata_act": null,
    "suprafata_masurata": null,
    "status_toleranta": "verde",
    "observatie": "Explicație scurtă privind încadrarea în toleranțe sau modificarea limitelor"
  },
  "constructii": [
    {
      "cod": "C1",
      "destinatie": "locuinta/anexa",
      "suprafata_noua": null,
      "an_constructie": null,
      "temei_legal": "Temei identificat",
      "status_audit": "verde",
      "observatie": "Explicație legală/tehnică direct aplicabilă"
    }
  ],
  "recomandare_memoriu": "Text sintetic de redactat în Punctul 4 din Memoriul Tehnic"
}
`;

        // Apel direct pe noul model Gemini 2.5 Flash
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        {
                            inline_data: {
                                mime_type: mimeType || 'application/pdf',
                                data: base64Data
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    response_mime_type: "application/json"
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Eroare detaliată Gemini:', JSON.stringify(data));
            const msg = data?.error?.message || 'Eroare necunoscută Google API';
            return res.status(500).json({ error: `Eroare Google AI: ${msg}` });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!aiText) {
             return res.status(500).json({ error: 'AI-ul nu a generat niciun răspuns text.' });
        }

        const jsonResult = JSON.parse(aiText);
        return res.status(200).json(jsonResult);

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ error: 'Eroare de procesare server', message: error.message });
    }
}
