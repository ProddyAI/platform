import { Check, X } from "lucide-react";

import {
	calculatePasswordStrength,
	getPasswordRequirements,
} from "../utils/password-validation";

interface PasswordStrengthIndicatorProps {
	password: string;
	showRequirements?: boolean;
}

// Score-indexed label colors (token-based, >=4.5:1 contrast on the app
// background).
const SCORE_LABEL_COLORS: Record<number, string> = {
	0: "text-destructive",
	1: "text-destructive",
	2: "text-warning",
	3: "text-primary",
	4: "text-success",
};

// Score-indexed strength-bar fill colors — kept independent of
// `strength.color` (raw `bg-*-500` utilities from the validation util) so the
// meter stays on design tokens.
const SCORE_BAR_COLORS: Record<number, string> = {
	0: "bg-destructive",
	1: "bg-destructive/70",
	2: "bg-warning",
	3: "bg-primary",
	4: "bg-success",
};

export const PasswordStrengthIndicator = ({
	password,
	showRequirements = true,
}: PasswordStrengthIndicatorProps) => {
	const strength = calculatePasswordStrength(password);
	const requirements = getPasswordRequirements(password);

	if (!password) return null;

	return (
		<div className="space-y-3">
			{/* Strength Bar */}
			<div className="space-y-1.5">
				<div className="flex items-center justify-between text-xs">
					<span className="text-muted-foreground">Password Strength</span>
					<span
						className={`font-medium ${
							SCORE_LABEL_COLORS[strength.score] ?? "text-muted-foreground"
						}`}
					>
						{strength.label}
					</span>
				</div>
				<div className="flex gap-1 h-1.5">
					{/* Fixed 5-segment strength meter, positions not entities (JS-0437 exemption) — index is a safe key here */}
					{[...Array(5)].map((_, index) => (
						<div
							className={`flex-1 rounded-full transition-all duration-300 ${
								index <= strength.score
									? SCORE_BAR_COLORS[strength.score]
									: "bg-muted"
							}`}
							key={`strength-bar-${index}`}
						/>
					))}
				</div>
			</div>

			{/* Requirements List */}
			{showRequirements && (
				<div className="space-y-1.5">
					{requirements.map((requirement) => (
						<div
							className="flex items-center gap-2 text-xs"
							key={requirement.label}
						>
							{requirement.met ? (
								<Check className="size-3.5 text-success flex-shrink-0" />
							) : (
								<X className="size-3.5 text-muted-foreground flex-shrink-0" />
							)}
							<span
								className={`${
									requirement.met ? "text-success" : "text-muted-foreground"
								} transition-colors duration-200`}
							>
								{requirement.label}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
};
