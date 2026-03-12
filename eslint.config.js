export default [
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                window: "readonly",
                document: "readonly",
                fetch: "readonly",
                console: "readonly",
                alert: "readonly",
                confirm: "readonly",
                prompt: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                localStorage: "readonly",
                navigator: "readonly",
                process: "readonly",
                ev: "readonly",
                event: "readonly",
                Number: "readonly"
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-undef": "error"
        }
    }
];
