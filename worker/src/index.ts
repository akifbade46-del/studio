/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Secrets
	GH_PAT: string; // GitHub Personal Access Token
	GH_OWNER: string; // GitHub repository owner
	GH_REPO: string; // GitHub repository name

	// Vars
	GH_USER: string; // GitHub user name for commits
	GH_EMAIL: string; // GitHub user email for commits
	ALLOWED_ORIGIN_1: string;
	ALLOWED_ORIGIN_2: string;
}

const DATA_PATH = 'data/surveys';

// --- UTILITY FUNCTIONS ---

function jsonResponse(data: any, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		headers: { 'Content-Type': 'application/json' },
		status,
	});
}

function errorResponse(message: string, status = 400) {
	return jsonResponse({ error: message }, status);
}

function handleCors(request: Request, env: Env) {
	const origin = request.headers.get('Origin');
	const allowedOrigins = [env.ALLOWED_ORIGIN_1, env.ALLOWED_ORIGIN_2, `https://main--${env.GH_REPO}--${env.GH_OWNER}.code.run`, `https://*.firebase.studio`].filter(Boolean);

	const corsHeaders: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Signature',
		'Access-Control-Max-Age': '86400',
	};

	if (allowedOrigins.some(allowed => new RegExp(allowed.replace('*', '.*')).test(origin!))) {
		corsHeaders['Access-Control-Allow-Origin'] = origin!;
	}

	if (request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders });
	}

	return { corsHeaders };
}


async function githubApi(path: string, method: string, token: string, body?: object) {
	const url = `https://api.github.com/repos/${path}`;
	const options: RequestInit = {
		method,
		headers: {
			'Authorization': `token ${token}`,
			'User-Agent': 'Qgo-Cargo-Worker',
			'Accept': 'application/vnd.github.v3+json',
			'Content-Type': 'application/json',
		},
	};
	if (body) {
		options.body = JSON.stringify(body);
	}
	return fetch(url, options);
}

// --- ROUTE HANDLERS ---

async function handleHealthCheck() {
	return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
}

async function handleGetSurvey(request: Request, env: Env, surveyId: string) {
	if (!surveyId) {
		return errorResponse('Survey ID is required.', 400);
	}
	const filePath = `${DATA_PATH}/${surveyId}.json`;
	const response = await githubApi(`${env.GH_OWNER}/${env.GH_REPO}/contents/${filePath}`, 'GET', env.GH_PAT);

	if (!response.ok) {
		return errorResponse(`Survey not found: ${surveyId}`, 404);
	}
	const data: any = await response.json();
	const content = JSON.parse(atob(data.content));

	return jsonResponse(content);
}

async function handleListSurveys(request: Request, env: Env) {
    const response = await githubApi(`${env.GH_OWNER}/${env.GH_REPO}/contents/${DATA_PATH}`, 'GET', env.GH_PAT);

    if (!response.ok) {
        // If the directory doesn't exist, return an empty list which is not an error.
        if (response.status === 404) {
            return jsonResponse([]);
        }
        return errorResponse('Could not fetch surveys from GitHub.', 500);
    }

    const files: any[] = await response.json();
    const surveyList = files
        .filter(file => file.name.endsWith('.json'))
        .map(file => ({
            id: file.name.replace('.json', ''),
            size: file.size,
            url: file.html_url,
            path: file.path,
        }))
        .sort((a, b) => b.id.localeCompare(a.id)); // Sort descending by name (date)

    return jsonResponse(surveyList);
}


async function handlePostSurvey(request: Request, env: Env) {
	let surveyData;
	try {
		surveyData = await request.json();
	} catch (e) {
		return errorResponse('Invalid JSON payload.', 400);
	}

	// Basic validation
	if (!surveyData.customer || !surveyData.items) {
		return errorResponse('Missing required survey data.', 400);
	}
    
    // Add server-side metadata
    surveyData.meta = surveyData.meta || {};
    surveyData.meta.savedAt = new Date().toISOString();
    surveyData.meta.version = '1.0-worker';

	const surveyId = surveyData.id || `${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substring(2, 11)}`;
    surveyData.id = surveyId;

	const fileName = `${surveyId}.json`;
	const filePath = `${DATA_PATH}/${fileName}`;
	const contentBase64 = btoa(JSON.stringify(surveyData, null, 2));

	const commitBody = {
		message: `add survey ${surveyId}`,
		content: contentBase64,
		committer: {
			name: env.GH_USER || 'Qgo Cargo Worker',
			email: env.GH_EMAIL || 'worker@example.com',
		},
	};

	const response = await githubApi(`${env.GH_OWNER}/${env.GH_REPO}/contents/${filePath}`, 'PUT', env.GH_PAT, commitBody);
	const responseData = await response.json();

	if (!response.ok) {
		console.error('GitHub API Error:', responseData);
		return errorResponse('Failed to save survey to GitHub.', 500);
	}

	return jsonResponse({
		id: surveyId,
		url: responseData.content.html_url,
		commitSha: responseData.commit.sha,
	});
}

// --- MAIN WORKER ---

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const corsResponse = handleCors(request, env);
		if (corsResponse instanceof Response) {
			return corsResponse;
		}

		const { pathname } = new URL(request.url);
		let response: Response;

		try {
			if (pathname.startsWith('/survey/')) {
				const surveyId = pathname.split('/')[2];
				response = await handleGetSurvey(request, env, surveyId);
			} else if (pathname === '/surveys') {
				response = await handleListSurveys(request, env);
			} else if (pathname === '/survey' && request.method === 'POST') {
				response = await handlePostSurvey(request, env);
			} else if (pathname === '/health') {
				response = await handleHealthCheck();
			} else {
				response = errorResponse('Not Found', 404);
			}
		} catch (e: any) {
			console.error('Worker error:', e);
			response = errorResponse(`Internal Server Error: ${e.message}`, 500);
		}
        
        // Add CORS headers to the final response
        const finalResponse = new Response(response.body, response);
        Object.entries(corsResponse.corsHeaders).forEach(([key, value]) => {
            finalResponse.headers.set(key, value);
        });

		return finalResponse;
	},
};
