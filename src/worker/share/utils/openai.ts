export async function sendMessageToChatGPT(
	message: string,
	history: { role: string; content: string }[],
	apiKey?: string,
	params?: any
) {
	try {
		const body = {
			model: 'gpt-3.5-turbo',
			...params,
			messages: [...(history || []), { role: 'user', content: message }],
		};
		console.log('sendMessageToChatGPT', body.model, body.messages);
		const resp: Response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify(body),
		}).then(res => res.json());
		// @ts-ignore
		if (resp.error?.message) {
			// @ts-ignore
			return [true, `OpenAI API error\n> ${resp.error.message}`];
		}
		// @ts-ignore
		return [false, resp.choices[0].message.content];
	} catch (e) {
		console.error(e);
		// @ts-ignore
		return [true, `OpenAI invoke error`];
	}
}
