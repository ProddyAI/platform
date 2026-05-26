import { dodoApiKey, apiBase } from "./dodo";

export default async function run() {
	const res = await fetch(`${apiBase}/products`, {
		headers: {
			Authorization: `Bearer ${dodoApiKey}`,
		},
	});
	console.log(await res.json());
}
