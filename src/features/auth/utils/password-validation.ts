export interface PasswordRequirement {
	label: string;
	met: boolean;
	regex?: RegExp;
	check?: (password: string) => boolean;
}

export interface PasswordStrength {
	score: number; // 0-4
	label: "Very Weak" | "Weak" | "Fair" | "Good" | "Strong";
	color: string;
}

export const getPasswordRequirements = (
	password: string
): PasswordRequirement[] => {
	return [
		{
			label: "At least 8 characters",
			met: password.length >= 8,
		},
		{
			label: "Contains uppercase letter (A-Z)",
			met: /[A-Z]/.test(password),
		},
		{
			label: "Contains lowercase letter (a-z)",
			met: /[a-z]/.test(password),
		},
		{
			label: "Contains number (0-9)",
			met: /\d/.test(password),
		},
		{
			label: "Contains special character (@.#$!%*?&)",
			met: /[@.#$!%*?&]/.test(password),
		},
	];
};

export const calculatePasswordStrength = (
	password: string
): PasswordStrength => {
	if (!password) {
		return { score: 0, label: "Very Weak", color: "bg-gray-300" };
	}

	const requirements = getPasswordRequirements(password);
	const metCount = requirements.filter((req) => req.met).length;

	// Additional strength factors
	let bonusPoints = 0;
	if (password.length >= 12) bonusPoints += 0.5;
	if (password.length >= 16) bonusPoints += 0.5;
	if (/[^A-Za-z0-9@.#$!%*?&]/.test(password)) bonusPoints += 0.5; // Additional special chars

	const score = Math.min(4, Math.floor(metCount + bonusPoints));

	const strengthMap: Record<number, PasswordStrength> = {
		0: { score: 0, label: "Very Weak", color: "bg-red-500" },
		1: { score: 1, label: "Weak", color: "bg-orange-500" },
		2: { score: 2, label: "Fair", color: "bg-yellow-500" },
		3: { score: 3, label: "Good", color: "bg-blue-500" },
		4: { score: 4, label: "Strong", color: "bg-green-500" },
	};

	return strengthMap[score];
};

export const isPasswordValid = (password: string): boolean => {
	const requirements = getPasswordRequirements(password);
	return requirements.every((req) => req.met);
};
