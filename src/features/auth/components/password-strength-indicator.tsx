import { Check, X } from "lucide-react";

import {
	calculatePasswordStrength,
	getPasswordRequirements,
} from "../utils/password-validation";

interface PasswordStrengthIndicatorProps {
	password: string;
	showRequirements?: boolean;
}

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
							strength.score === 0
								? "text-red-600"
								: strength.score === 1
									? "text-orange-600"
									: strength.score === 2
										? "text-yellow-600"
										: strength.score === 3
											? "text-blue-600"
											: "text-green-600"
						}`}
					>
						{strength.label}
					</span>
				</div>
				<div className="flex gap-1 h-1.5">
					{[...Array(5)].map((_, index) => (
						<div
							className={`flex-1 rounded-full transition-all duration-300 ${
								index <= strength.score ? strength.color : "bg-gray-200"
							}`}
							key={index}
						/>
					))}
				</div>
			</div>

			{/* Requirements List */}
			{showRequirements && (
				<div className="space-y-1.5">
					{requirements.map((requirement, index) => (
						<div className="flex items-center gap-2 text-xs" key={index}>
							{requirement.met ? (
								<Check className="size-3.5 text-green-600 flex-shrink-0" />
							) : (
								<X className="size-3.5 text-gray-400 flex-shrink-0" />
							)}
							<span
								className={`${
									requirement.met ? "text-green-600" : "text-muted-foreground"
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
