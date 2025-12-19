'use client';

import { useEffect } from 'react';
import formbricks from '@formbricks/js';

export const Formbricks = () => {
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const environmentId = process.env.NEXT_PUBLIC_FORMBRICKS_ID;

            if (environmentId) {
                formbricks.setup({
                    environmentId,
                    appUrl: 'https://app.formbricks.com',
                });
            }
        }
    }, []);

    return null;
};
