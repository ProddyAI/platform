import { StreamVideoClient, type User } from "@stream-io/video-react-sdk";

type CreateStreamClientArgs = {
	apiKey?: string;
	userId?: string;
	token?: string;
	name?: string;
	image?: string;
};

type AuthenticatedStreamUser = Extract<User, { type?: "authenticated" }>;

export function createStreamClient(args: CreateStreamClientArgs): StreamVideoClient;
export function createStreamClient(
	apiKey: string,
	user: AuthenticatedStreamUser,
	token: string
): StreamVideoClient;
export function createStreamClient(
	argsOrApiKey: CreateStreamClientArgs | string,
	user?: AuthenticatedStreamUser,
	tokenArg?: string
) {
	const args =
		typeof argsOrApiKey === "string"
			? {
					apiKey: argsOrApiKey,
					userId: user?.id,
					token: tokenArg,
					name: user?.name,
					image: user?.image,
				}
			: argsOrApiKey;

	const { apiKey, userId, token, name, image } = args;

	if (!apiKey) {
		throw new Error("Stream API key is missing");
	}

	if (!userId) {
		throw new Error("Stream user is missing");
	}

	if (!token) {
		throw new Error("Stream token is missing");
	}

	return new StreamVideoClient({
		apiKey,
		token,
		user: {
			id: userId,
			...(name ? { name } : {}),
			...(image ? { image } : {}),
		},
	});
}
