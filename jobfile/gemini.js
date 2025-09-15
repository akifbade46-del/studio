export async function callGeminiApi(promptText) {
    const apiKey = "AIzaSyChmm3BqF6aBPEg-4M7zDHRstERk8sCgL8";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: promptText }]
        }]
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`API call failed with status ${response.status}`);
        }
        const result = await response.json();
        if (result.candidates?.[0]?.content?.parts?.[0]) {
            return result.candidates[0].content.parts[0].text;
        }
        return null;
    } catch (error) {
        console.error("Gemini API call failed:", error);
        throw error;
    }
}
