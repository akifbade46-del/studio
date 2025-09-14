import { showLoader, hideLoader, showNotification, addChargeRow, populateTable } from './ui.js';
import { getFormData } from './utils.js';
import { chargeDescriptions } from './state.js';

async function callGeminiApi(payload, retries = 3, delay = 1000) {
    const apiKey = "AIzaSyChmm3BqF6aBPEg-4M7zDHRstERk8sCgL8"; 
    if (!apiKey || apiKey === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
        throw new Error("Gemini API key is missing.");
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (response.status === 429 && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, delay));
                return callGeminiApi(payload, retries - 1, delay * 2);
            }
            const errorBody = await response.json();
            throw new Error(`API call failed with status ${response.status}: ${errorBody.error.message}`);
        }
        return await response.json();
    } catch (error) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return callGeminiApi(payload, retries - 1, delay * 2);
        }
        console.error("API call failed after multiple retries:", error);
        throw error;
    }
}

export async function generateRemarks() {
    showLoader();
    try {
        const data = getFormData();
        const prompt = `
            Generate professional remarks for a freight forwarding job file with the following details.
            The remarks should be concise and summarize the key aspects of the shipment.

            - Product Type: ${(data.pt || []).join(', ') || 'Not specified'}
            - Clearance Type: ${(data.cl || []).join(', ') || 'Not specified'}
            - Shipper: ${data.sh || 'Not specified'}
            - Consignee: ${data.co || 'Not specified'}
            - Origin: ${data.or || 'Not specified'}
            - Destination: ${data.de || 'Not specified'}
            - Description of Goods: ${data.dsc || 'Not specified'}
            - Carrier: ${data.ca || 'Not specified'}
            - MAWB/OBL: ${data.mawb || 'Not specified'}

            Generate a short paragraph suitable for the remarks section.
        `;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        const result = await callGeminiApi(payload);
        
        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            const text = result.candidates[0].content.parts[0].text;
            document.getElementById('remarks').value = text;
            showNotification("Remarks generated successfully! ✨");
        } else {
            throw new Error("Invalid response structure from Gemini API.");
        }

    } catch (error) {
        console.error("Error generating remarks:", error);
        showNotification(`Could not generate remarks. AI feature might be disabled. Error: ${error.message}`, true);
    } finally {
        hideLoader();
    }
}

export async function suggestCharges() {
    showLoader();
    try {
        const data = getFormData();
        
        const prompt = `
            Based on the following freight forwarding job details, suggest typical cost and selling prices in Kuwaiti Dinar (KD) for relevant charges.
            Provide reasonable, non-zero estimates for relevant charges. Only include charges that are applicable.
            
            - Product Type: ${(data.pt || []).join(', ') || 'General'}
            - Clearance Type: ${(data.cl || []).join(', ') || 'Standard'}
            - Origin: ${data.or || 'Unknown'}
            - Destination: ${data.de || 'Unknown'}
            - Description of Goods: ${data.dsc || 'General Goods'}
            - Gross Weight: ${data.gw || 'N/A'}
            - Predefined Charges: ${chargeDescriptions.join(', ')}

            Respond in JSON format with a single key "charges" which is an array of objects, each with "chargeName", "cost", and "selling" properties.
            Example: {"charges": [{"chargeName": "Customs Duty", "cost": 150.500, "selling": 160.000}]}
        `;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        };

        const result = await callGeminiApi(payload);

        if (result.candidates && result.candidates[0]?.content?.parts?.[0]) {
            
            const jsonText = result.candidates[0].content.parts[0].text;
            const parsedJson = JSON.parse(jsonText);
            
            if (parsedJson.charges && Array.isArray(parsedJson.charges)) {
                const tableBody = document.getElementById('charges-table-body');
                tableBody.innerHTML = '';
                if(parsedJson.charges.length === 0){
                     populateTable();
                } else {
                    parsedJson.charges.forEach(charge => {
                        addChargeRow({
                            l: charge.chargeName,
                            c: charge.cost || 0,
                            s: charge.selling || 0,
                            n: ''
                        });
                    });
                }
                
                showNotification("Charges suggested successfully! ✨");
            } else {
                 throw new Error("Invalid JSON structure in API response.");
            }
        } else {
            throw new Error("Invalid response structure from Gemini API.");
        }

    } catch (error) {
        console.error("Error suggesting charges:", error);
        showNotification(`Could not suggest charges. AI feature might be disabled. Error: ${error.message}`, true);
    } finally {
        hideLoader();
    }
}
