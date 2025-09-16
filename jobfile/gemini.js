export async function callGeminiApi(promptText, isJson = false) {
    const apiKey = "YOUR_API_KEY"; // Replace with your actual API key
    if (!apiKey || apiKey === "YOUR_API_KEY") {
        console.error("Gemini API key is not set.");
        throw new Error("API key is missing.");
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: promptText }] }]
    };

    if (isJson) {
        payload.generationConfig = {
            responseMimeType: "application/json",
        };
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API Error Response:", errorBody);
            throw new Error(`API call failed with status ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.candidates?.[0]?.content?.parts?.[0]) {
            return result.candidates[0].content.parts[0].text;
        }
        
        // Handle cases where the model might return a finishReason of "SAFETY"
        if(result.candidates?.[0]?.finishReason === 'SAFETY') {
            throw new Error("Content blocked due to safety settings.");
        }

        throw new Error("Invalid response structure from Gemini API.");
    } catch (error) {
        console.error("Gemini API call failed:", error);
        throw error;
    }
}

