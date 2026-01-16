module.exports = [
"[project]/components/sections/Hero.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Hero
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
'use client';
;
function Hero({ content }) {
    const lines = content.subtitle.split('\n').filter((line)=>line.trim());
    // Couper le texte après "and" : première ligne plus longue, deuxième ligne plus courte, centré
    const splitText = (text)=>{
        // Chercher "and" comme point de coupure (après le mot "and")
        const andIndex = text.toLowerCase().indexOf(' and ');
        if (andIndex > 0) {
            return [
                text.substring(0, andIndex + ' and'.length).trim(),
                text.substring(andIndex + ' and'.length).trim()
            ];
        }
        // Sinon, chercher la dernière virgule avant 70%
        const splitPoint = Math.floor(text.length * 0.7);
        let bestSplit = splitPoint;
        for(let i = splitPoint; i > Math.max(0, splitPoint - 50); i--){
            if (text[i] === ',') {
                bestSplit = i + 1;
                break;
            }
        }
        return [
            text.substring(0, bestSplit).trim(),
            text.substring(bestSplit).trim()
        ];
    };
    const [firstLine, secondLine] = lines[1] ? splitText(lines[1]) : [
        '',
        ''
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "relative overflow-hidden",
        style: {
            minHeight: '100vh',
            height: '100vh',
            paddingTop: '65px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 z-0",
                style: {
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: 'hidden'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
                        src: "https://player.vimeo.com/video/1138288074?background=1&autoplay=1&loop=1&muted=1",
                        style: {
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '177.77777778vh',
                            height: '100vh',
                            minWidth: '100%',
                            minHeight: '56.25vw',
                            pointerEvents: 'none',
                            border: 'none'
                        },
                        frameBorder: "0",
                        allow: "autoplay; fullscreen; picture-in-picture"
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Hero.tsx",
                        lineNumber: 58,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0",
                        style: {
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.4), rgba(0,0,0,0.6))',
                            zIndex: 10,
                            pointerEvents: 'none'
                        }
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Hero.tsx",
                        lineNumber: 75,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/sections/Hero.tsx",
                lineNumber: 48,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative z-20",
                style: {
                    width: '100%',
                    maxWidth: '100%',
                    padding: 'clamp(20px, 4vw, 60px)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box'
                },
                children: [
                    lines[0] && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        style: {
                            color: '#FF00E5',
                            fontFamily: 'Orbitron, sans-serif',
                            fontSize: 'clamp(18px, 3vw, 28px)',
                            fontWeight: 500,
                            textShadow: '0 0 10px rgba(255, 0, 229, 0.9), 0 0 30px rgba(255, 0, 229, 0.5)',
                            marginBlockEnd: '0px',
                            marginBottom: 'clamp(-5px, -0.5vw, -8px)',
                            marginTop: '0px'
                        },
                        children: lines[0]
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Hero.tsx",
                        lineNumber: 94,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "tracking-tight uppercase",
                        style: {
                            color: '#08F7FE',
                            fontFamily: 'Orbitron, sans-serif',
                            fontSize: 'clamp(32px, 6vw, 59px)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            textShadow: '0 0 15px rgba(8, 247, 254, 0.9), 0 0 40px rgba(8, 247, 254, 0.55)',
                            marginBlockEnd: '0px',
                            marginBottom: 'clamp(-2px, -0.2vw, 2px)',
                            marginTop: '0px'
                        },
                        children: content.title
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Hero.tsx",
                        lineNumber: 107,
                        columnNumber: 9
                    }, this),
                    lines[1] && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            marginTop: 'clamp(-4px, -0.4vw, -2px)',
                            marginBottom: 'clamp(20px, 4vw, 40px)',
                            maxWidth: 'min(90vw, 768px)',
                            marginLeft: 'auto',
                            marginRight: 'auto'
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-center",
                                style: {
                                    color: '#D2DDFF',
                                    fontFamily: 'Poppins, sans-serif',
                                    fontSize: 'clamp(14px, 2vw, 18px)',
                                    fontWeight: 400,
                                    lineHeight: '1.2',
                                    marginBlockEnd: '0px',
                                    marginBottom: '0px'
                                },
                                children: firstLine
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Hero.tsx",
                                lineNumber: 128,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-center",
                                style: {
                                    color: '#D2DDFF',
                                    fontFamily: 'Poppins, sans-serif',
                                    fontSize: 'clamp(14px, 2vw, 18px)',
                                    fontWeight: 400,
                                    lineHeight: '1.2',
                                    marginTop: '2px'
                                },
                                children: secondLine
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Hero.tsx",
                                lineNumber: 139,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/sections/Hero.tsx",
                        lineNumber: 121,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'clamp(12px, 2vw, 16px)',
                            width: '100%',
                            maxWidth: 'min(90vw, 600px)',
                            margin: '0 auto',
                            marginTop: 'clamp(1em, 3vw, 3em)'
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "#games",
                                onClick: (e)=>{
                                    e.preventDefault();
                                    document.querySelector('#games')?.scrollIntoView({
                                        behavior: 'smooth'
                                    });
                                },
                                className: "uppercase transition-all whitespace-nowrap",
                                style: {
                                    background: 'linear-gradient(90deg, #08f7fe 0%, #ff00e5 100%)',
                                    color: '#050714',
                                    fontFamily: 'Poppins, sans-serif',
                                    fontSize: 'clamp(14px, 2vw, 17px)',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    textDecoration: 'none',
                                    fill: '#050714',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 15px rgba(8, 247, 254, 0.75), 0 8px 30px rgba(255, 0, 229, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                    paddingTop: '0.4em',
                                    paddingBottom: '0.4em',
                                    paddingLeft: '1.2em',
                                    paddingRight: '1.2em',
                                    textAlign: 'center',
                                    display: 'inline-block',
                                    width: 'clamp(200px, 30vw, 280px)',
                                    maxWidth: '100%',
                                    minWidth: '200px',
                                    boxSizing: 'border-box'
                                },
                                onMouseEnter: (e)=>{
                                    e.currentTarget.style.background = 'linear-gradient(90deg, #05D1D7 0%, #ff00e5 100%)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(8, 247, 254, 0.9), 0 10px 40px rgba(255, 0, 229, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                },
                                onMouseLeave: (e)=>{
                                    e.currentTarget.style.background = 'linear-gradient(90deg, #08f7fe 0%, #ff00e5 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(8, 247, 254, 0.75), 0 8px 30px rgba(255, 0, 229, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                },
                                children: content.cta1
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Hero.tsx",
                                lineNumber: 162,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "#concept",
                                onClick: (e)=>{
                                    e.preventDefault();
                                    document.querySelector('#concept')?.scrollIntoView({
                                        behavior: 'smooth'
                                    });
                                },
                                className: "uppercase transition-all whitespace-nowrap",
                                style: {
                                    background: 'linear-gradient(90deg, #08f7fe 0%, #ff00e5 100%)',
                                    color: '#050714',
                                    fontFamily: 'Poppins, sans-serif',
                                    fontSize: 'clamp(14px, 2vw, 17px)',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    textDecoration: 'none',
                                    fill: '#050714',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 15px rgba(8, 247, 254, 0.75), 0 8px 30px rgba(255, 0, 229, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                                    paddingTop: '0.4em',
                                    paddingBottom: '0.4em',
                                    paddingLeft: '1.2em',
                                    paddingRight: '1.2em',
                                    textAlign: 'center',
                                    display: 'inline-block',
                                    width: 'clamp(200px, 30vw, 280px)',
                                    maxWidth: '100%',
                                    minWidth: '200px',
                                    boxSizing: 'border-box'
                                },
                                onMouseEnter: (e)=>{
                                    e.currentTarget.style.background = 'linear-gradient(90deg, #05D1D7 0%, #ff00e5 100%)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(8, 247, 254, 0.9), 0 10px 40px rgba(255, 0, 229, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                },
                                onMouseLeave: (e)=>{
                                    e.currentTarget.style.background = 'linear-gradient(90deg, #08f7fe 0%, #ff00e5 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(8, 247, 254, 0.75), 0 8px 30px rgba(255, 0, 229, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                },
                                children: content.cta2
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Hero.tsx",
                                lineNumber: 204,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/sections/Hero.tsx",
                        lineNumber: 151,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/sections/Hero.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/sections/Hero.tsx",
        lineNumber: 39,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=components_sections_Hero_tsx_a57c9280._.js.map