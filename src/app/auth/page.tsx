"use client";

import { redirect } from "next/navigation";
import { useEffect } from "react";

const AuthPage = () => {
	useEffect(() => {
		redirect("/auth/signin");
	}, []);

	return null;
};

export default AuthPage;
