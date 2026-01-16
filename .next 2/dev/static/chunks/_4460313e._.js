(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/components/sections/Hero.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Hero
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
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
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("iframe", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                    lines[0] && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
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
                    lines[1] && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            marginTop: 'clamp(-4px, -0.4vw, -2px)',
                            marginBottom: 'clamp(20px, 4vw, 40px)',
                            maxWidth: 'min(90vw, 768px)',
                            marginLeft: 'auto',
                            marginRight: 'auto'
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
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
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
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
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "#games",
                                onClick: (e)=>{
                                    e.preventDefault();
                                    document.querySelector('#games')?.scrollIntoView({
                                        behavior: 'smooth'
                                    });
                                },
                                className: "glow-button",
                                style: {
                                    fontFamily: 'Poppins, sans-serif',
                                    width: 'clamp(200px, 30vw, 280px)',
                                    textAlign: 'center'
                                },
                                children: content.cta1
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Hero.tsx",
                                lineNumber: 162,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "#concept",
                                onClick: (e)=>{
                                    e.preventDefault();
                                    document.querySelector('#concept')?.scrollIntoView({
                                        behavior: 'smooth'
                                    });
                                },
                                className: "glow-button",
                                style: {
                                    fontFamily: 'Poppins, sans-serif',
                                    width: 'clamp(200px, 30vw, 280px)',
                                    textAlign: 'center'
                                },
                                children: content.cta2
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Hero.tsx",
                                lineNumber: 177,
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
_c = Hero;
var _c;
__turbopack_context__.k.register(_c, "Hero");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/sections/Concept.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Concept
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$watch$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Watch$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/watch.js [app-client] (ecmascript) <export default as Watch>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/users.js [app-client] (ecmascript) <export default as Users>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/clock.js [app-client] (ecmascript) <export default as Clock>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$gamepad$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Gamepad2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/gamepad-2.js [app-client] (ecmascript) <export default as Gamepad2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trophy.js [app-client] (ecmascript) <export default as Trophy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.js [app-client] (ecmascript) <export default as Zap>");
'use client';
;
;
function Concept({ content }) {
    // Détecter la langue
    const isEnglish = !/[א-ת]/.test(content.description);
    // Textes selon la langue - basés sur active-games-main
    const featureTexts = isEnglish ? [
        'Up to 6 players',
        '60 minutes of action',
        'Smart bracelet',
        '8 different rooms',
        'Competitive or Team',
        'Your strategy wins'
    ] : [
        'עד 6 שחקנים',
        '60 דקות אקשן',
        'צמיד חכם',
        '8 חדרים שונים',
        'תחרותי או צוותי',
        'האסטרטגיה שלכם מנצחת'
    ];
    const features = [
        {
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"],
            text: featureTexts[0]
        },
        {
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock$3e$__["Clock"],
            text: featureTexts[1]
        },
        {
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$watch$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Watch$3e$__["Watch"],
            text: featureTexts[2]
        },
        {
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$gamepad$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Gamepad2$3e$__["Gamepad2"],
            text: featureTexts[3]
        },
        {
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"],
            text: featureTexts[4]
        },
        {
            icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"],
            text: featureTexts[5]
        }
    ];
    // Parser description en paragraphes
    const descriptionParagraphs = content.description.split('\n\n').filter((p)=>p.trim());
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        id: "concept",
        className: "py-20 relative overflow-hidden",
        style: {
            background: 'linear-gradient(180deg, rgba(220,50,200,0.75) 0%, rgba(180,80,170,1) 100%)',
            borderRadius: '28px',
            boxShadow: '0px 0px 40px 0px rgba(0, 0, 0, 0.7)',
            marginTop: '0px',
            marginLeft: 'clamp(16px, 2vw, 40px)',
            marginRight: 'clamp(16px, 2vw, 40px)',
            paddingTop: 'clamp(40px, 6vw, 80px)',
            paddingBottom: 'clamp(40px, 6vw, 80px)',
            minHeight: '400px'
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "container mx-auto relative z-10",
            style: {
                paddingLeft: 'clamp(60px, 12vw, 160px)',
                paddingRight: 'clamp(60px, 12vw, 160px)'
            },
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-w-3xl",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-center mb-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "section-title",
                                style: {
                                    color: '#ffffff',
                                    textShadow: '0 0 15px rgba(255, 255, 255, 0.9), 0 0 40px rgba(8, 247, 254, 0.55), 0 0 60px rgba(255, 0, 229, 0.3)'
                                },
                                children: content.title
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Concept.tsx",
                                lineNumber: 52,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "leading-relaxed",
                                style: {
                                    fontFamily: 'Poppins, sans-serif',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    color: '#ffffff',
                                    fontSize: '1.25rem'
                                },
                                children: isEnglish ? 'Active Games is an innovative interactive gaming complex based on teamwork, movement, and strategic thinking.' : 'אקטיב גיימס הוא מתחם משחקים אינטראקטיבי חדשני המבוסס על עבודת צוות, תנועה וחשיבה אסטרטגית.'
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Concept.tsx",
                                lineNumber: 53,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/sections/Concept.tsx",
                        lineNumber: 51,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-12",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-3",
                            style: {
                                gap: '2rem'
                            },
                            children: features.map((feature, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "backdrop-blur-sm text-center transition-all duration-300",
                                    style: {
                                        backgroundColor: 'rgba(26, 26, 46, 0.5)',
                                        borderRadius: '16px',
                                        border: '2px solid rgba(0, 240, 255, 0.3)',
                                        boxShadow: '0 4px 20px rgba(0, 240, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                        padding: '1rem 0.875rem',
                                        minWidth: '120px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    },
                                    onMouseEnter: (e)=>{
                                        e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.6)';
                                        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 240, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    },
                                    onMouseLeave: (e)=>{
                                        e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.3)';
                                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 240, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(feature.icon, {
                                            className: "w-8 h-8 mx-auto",
                                            style: {
                                                color: '#08F7FE',
                                                filter: 'drop-shadow(0 0 8px rgba(8, 247, 254, 0.8))',
                                                marginBottom: '0.75rem'
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/components/sections/Concept.tsx",
                                            lineNumber: 90,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-sm font-medium",
                                            style: {
                                                fontFamily: 'Poppins, sans-serif',
                                                color: '#ffffff',
                                                margin: 0
                                            },
                                            children: feature.text
                                        }, void 0, false, {
                                            fileName: "[project]/components/sections/Concept.tsx",
                                            lineNumber: 91,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, index, true, {
                                    fileName: "[project]/components/sections/Concept.tsx",
                                    lineNumber: 64,
                                    columnNumber: 17
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/components/sections/Concept.tsx",
                            lineNumber: 62,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Concept.tsx",
                        lineNumber: 61,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-6",
                        children: descriptionParagraphs.map((paragraph, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "leading-relaxed text-left",
                                style: {
                                    fontFamily: 'Poppins, sans-serif',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    color: '#ffffff',
                                    fontSize: '1.125rem'
                                },
                                children: paragraph.trim()
                            }, index, false, {
                                fileName: "[project]/components/sections/Concept.tsx",
                                lineNumber: 100,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Concept.tsx",
                        lineNumber: 98,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/sections/Concept.tsx",
                lineNumber: 49,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/sections/Concept.tsx",
            lineNumber: 45,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/sections/Concept.tsx",
        lineNumber: 34,
        columnNumber: 5
    }, this);
}
_c = Concept;
var _c;
__turbopack_context__.k.register(_c, "Concept");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/games.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Mapping des assets pour les jeux
__turbopack_context__.s([
    "gameAssets",
    ()=>gameAssets,
    "gameNameToKey",
    ()=>gameNameToKey
]);
const gameAssets = {
    grid: {
        thumb: '/images/1.png',
        video: '/videos/Grille-active-games.mp4',
        popup: '/images/1.png'
    },
    arena: {
        thumb: '/images/2.png',
        video: '/videos/Video-sans-titre-‐-Realisee-avec-Clipchamp-2.mp4',
        popup: '/images/2.png'
    },
    push: {
        thumb: '/images/3.png',
        video: '/videos/PUSH.mp4',
        popup: '/images/3.png'
    },
    basketball: {
        thumb: '/images/4.png',
        video: '/videos/Hoops-Basketball.mp4',
        popup: '/images/4.png'
    },
    climbing: {
        thumb: '/images/5.png',
        video: '/videos/climb.mp4',
        popup: '/images/5.png'
    },
    hide: {
        thumb: '/images/6.png',
        video: '/videos/hide-activate.mp4',
        popup: '/images/6.png'
    },
    flash: {
        thumb: '/images/1.png',
        video: '/videos/flash.mp4',
        popup: '/images/1.png'
    },
    laser: {
        thumb: '/images/2.png',
        video: '/videos/laser.mp4',
        popup: '/images/2.png'
    },
    control: {
        thumb: '/images/3.png',
        video: '/videos/control.mp4',
        popup: '/images/3.png'
    }
};
const gameNameToKey = {
    'Grid': 'grid',
    'Arena': 'arena',
    'Push': 'push',
    'Hoops Basketball': 'basketball',
    'Basketball': 'basketball',
    'Climbing': 'climbing',
    'Hide Game Room': 'hide',
    'Hide': 'hide',
    'Flash': 'flash',
    'Laser': 'laser',
    'Control': 'control',
    // Hébreu
    'גריד': 'grid',
    'ארינה': 'arena',
    'פוש': 'push',
    'הופס בסקטבול': 'basketball',
    'טיפוס': 'climbing',
    'הייד': 'hide',
    'פלאש': 'flash',
    'לייזר': 'laser',
    'קונטרול': 'control'
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/sections/Games.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Games
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$games$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/games.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
// Données par défaut pour popup_description et features
const gamePopupData = {
    grid: {
        popup_description: 'The Active Games Grid immerses players in a captivating challenge of logic and reasoning on an interactive board. This dynamic game tests your analytical skills and strategy to complete the grid and achieve the objectives.',
        features: [
            '5 game modes',
            '50 levels to explore'
        ]
    },
    arena: {
        popup_description: 'An interactive LED hexagon target wall where players use dodgeballs to hit glowing targets. Each match combines memory, agility, and speed. Hit the right colors and avoid the red zones to maximize your score.',
        features: [
            '4 game modes',
            '40 levels to explore'
        ]
    },
    push: {
        popup_description: 'Push is an observation and strategy challenge game. Surrounded by multi-colored button walls, players need to quickly identify patterns and use strategy, memory, and collaboration to press the right buttons within the time limit.',
        features: [
            '5 game modes',
            '50 levels to explore'
        ]
    },
    basketball: {
        popup_description: 'A fully interactive fitness experience that combines the excitement of sports, the challenge of competition, and the innovation of modern technology. Every shot is recorded in real time.',
        features: [
            'LED-lit targets',
            'Smart sensor tracking'
        ]
    },
    climbing: {
        popup_description: 'An interactive LED climbing wall game that simulates the thrill of cliff climbing. Players must step carefully along a narrow edge, grabbing green safe lights to move forward.',
        features: [
            'Grab green safe lights',
            'Avoid dangerous red zones'
        ]
    },
    hide: {
        popup_description: 'A thrilling blend of stealth, strategy, and teamwork. Powered by advanced motion-sensing technology, the game challenges players to outsmart glowing « eyes » while completing interactive light sequences.',
        features: [
            '4 game modes',
            '40 levels to explore'
        ]
    },
    flash: {
        popup_description: 'Flash is a game of quick reaction challenges. Light tubes cover the walls and a flash of electricity falls from the ceiling – you need to react quickly to intercept each flash before it reaches the end.',
        features: [
            '4 game modes',
            '40 levels to explore'
        ]
    },
    laser: {
        popup_description: 'Creates a real-life action challenge where players must dodge, crawl, and weave through an array of laser beams. This exciting maze tests your reflexes, agility, and strategy.',
        features: [
            'Dynamic difficulty modes',
            'For kids, teens, and adults'
        ]
    },
    control: {
        popup_description: 'Players stand in front of the console and control the movement of the light blocks by tapping the buttons on the console or stepping on the LED tiles.',
        features: [
            'Console control',
            'LED tile interaction',
            'Strategy gameplay'
        ]
    }
};
function Games({ content }) {
    _s();
    const [selectedGame, setSelectedGame] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Transformer content.items (array) en Record et créer gameKeys
    const gamesRecord = {};
    content.items.forEach((game)=>{
        const key = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$games$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["gameNameToKey"][game.name] || game.name.toLowerCase().replace(/\s+/g, '');
        gamesRecord[key] = {
            name: game.name,
            description: game.description,
            popup_description: gamePopupData[key]?.popup_description || game.description,
            features: gamePopupData[key]?.features || []
        };
    });
    // Filtrer pour exclure "control"
    const gameKeys = Object.keys(gamesRecord).filter((key)=>key !== 'control');
    const isEnglish = !/[א-ת]/.test(content.title);
    const moreInfoText = isEnglish ? 'More info' : 'מידע נוסף';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        id: "games",
        className: "py-20 relative",
        style: {
            background: 'linear-gradient(180deg, rgba(126,227,230,0.52) 0%, rgba(136,224,226,0.65) 100%)',
            borderRadius: '28px',
            boxShadow: '0px 0px 40px 0px rgba(0, 0, 0, 0.7)',
            marginTop: '0px',
            marginLeft: 'clamp(16px, 2vw, 40px)',
            marginRight: 'clamp(16px, 2vw, 40px)',
            paddingTop: '3rem',
            paddingBottom: '3.2rem',
            paddingLeft: '2.2rem',
            paddingRight: '2.2rem'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "container mx-auto relative z-10",
                style: {
                    paddingLeft: 'clamp(60px, 12vw, 160px)',
                    paddingRight: 'clamp(60px, 12vw, 160px)'
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "max-w-3xl",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "text-center mb-6",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "section-title",
                                    style: {
                                        color: '#ffffff',
                                        textShadow: '0 0 15px rgba(255, 255, 255, 0.9), 0 0 40px rgba(8, 247, 254, 0.55), 0 0 60px rgba(255, 0, 229, 0.3)'
                                    },
                                    children: content.title
                                }, void 0, false, {
                                    fileName: "[project]/components/sections/Games.tsx",
                                    lineNumber: 104,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "leading-relaxed",
                                    style: {
                                        fontFamily: 'Poppins, sans-serif',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                        color: '#ffffff',
                                        fontSize: '1.25rem'
                                    },
                                    children: content.subtitle
                                }, void 0, false, {
                                    fileName: "[project]/components/sections/Games.tsx",
                                    lineNumber: 105,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/sections/Games.tsx",
                            lineNumber: 103,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-3",
                            style: {
                                gap: '2rem'
                            },
                            children: gameKeys.map((gameKey, index)=>{
                                const gameData = gamesRecord[gameKey];
                                const assets = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$games$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["gameAssets"][gameKey];
                                const hasVideo = assets && assets.video !== null;
                                if (!gameData || !assets) return null;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "game-card-new group cursor-pointer bg-dark-100/90 backdrop-blur-sm rounded-2xl overflow-hidden border border-primary/30 hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]",
                                    style: {
                                        margin: '0',
                                        borderRadius: '1rem'
                                    },
                                    onClick: ()=>setSelectedGame(gameKey),
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative bg-black rounded-t-2xl overflow-hidden",
                                            style: {
                                                height: '220px'
                                            },
                                            children: hasVideo ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                                className: "w-full h-full object-cover",
                                                autoPlay: true,
                                                loop: true,
                                                muted: true,
                                                playsInline: true,
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("source", {
                                                        src: assets.video,
                                                        type: "video/mp4"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Games.tsx",
                                                        lineNumber: 137,
                                                        columnNumber: 25
                                                    }, this),
                                                    "Your browser does not support the video tag."
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/sections/Games.tsx",
                                                lineNumber: 130,
                                                columnNumber: 23
                                            }, this) : assets && 'thumb' in assets && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                src: assets.thumb,
                                                alt: gameData.name,
                                                fill: true,
                                                className: "object-cover",
                                                unoptimized: true
                                            }, void 0, false, {
                                                fileName: "[project]/components/sections/Games.tsx",
                                                lineNumber: 142,
                                                columnNumber: 25
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/sections/Games.tsx",
                                            lineNumber: 128,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                paddingTop: '0.25rem',
                                                paddingBottom: '0.25rem',
                                                paddingLeft: '1.5rem',
                                                paddingRight: '1.5rem',
                                                backgroundColor: 'rgba(65, 70, 85, 0.92)'
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "font-display text-2xl font-bold mb-3 transition-colors",
                                                    style: {
                                                        color: '#ffffff'
                                                    },
                                                    children: gameData.name
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Games.tsx",
                                                    lineNumber: 153,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-base line-clamp-3 mb-4 leading-relaxed",
                                                    style: {
                                                        fontFamily: 'Poppins, sans-serif',
                                                        color: '#ffffff'
                                                    },
                                                    children: gameData.description
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Games.tsx",
                                                    lineNumber: 156,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    className: "text-base font-medium hover:underline flex items-center gap-2",
                                                    style: {
                                                        fontFamily: 'Poppins, sans-serif',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: 0,
                                                        color: '#00f0ff'
                                                    },
                                                    children: [
                                                        moreInfoText,
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "group-hover:translate-x-1 transition-transform",
                                                            children: "→"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/sections/Games.tsx",
                                                            lineNumber: 164,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/sections/Games.tsx",
                                                    lineNumber: 159,
                                                    columnNumber: 21
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/sections/Games.tsx",
                                            lineNumber: 152,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, gameKey, true, {
                                    fileName: "[project]/components/sections/Games.tsx",
                                    lineNumber: 119,
                                    columnNumber: 17
                                }, this);
                            })
                        }, void 0, false, {
                            fileName: "[project]/components/sections/Games.tsx",
                            lineNumber: 110,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/sections/Games.tsx",
                    lineNumber: 102,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/sections/Games.tsx",
                lineNumber: 101,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnimatePresence"], {
                children: selectedGame && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                    initial: {
                        opacity: 0
                    },
                    animate: {
                        opacity: 1
                    },
                    exit: {
                        opacity: 0
                    },
                    className: "modal-overlay",
                    onClick: ()=>setSelectedGame(null),
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                        initial: {
                            opacity: 0,
                            scale: 0.9,
                            y: 20
                        },
                        animate: {
                            opacity: 1,
                            scale: 1,
                            y: 0
                        },
                        exit: {
                            opacity: 0,
                            scale: 0.9,
                            y: 20
                        },
                        className: "modal-content",
                        onClick: (e)=>e.stopPropagation(),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setSelectedGame(null),
                                className: "absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                                style: {
                                    backgroundColor: 'rgba(60, 60, 70, 0.9)',
                                    color: '#ffffff'
                                },
                                onMouseEnter: (e)=>{
                                    e.currentTarget.style.backgroundColor = 'rgba(70, 70, 80, 0.9)';
                                },
                                onMouseLeave: (e)=>{
                                    e.currentTarget.style.backgroundColor = 'rgba(60, 60, 70, 0.9)';
                                },
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                    size: 20,
                                    style: {
                                        color: '#ffffff'
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/components/sections/Games.tsx",
                                    lineNumber: 199,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Games.tsx",
                                lineNumber: 192,
                                columnNumber: 15
                            }, this),
                            (()=>{
                                const gameData = gamesRecord[selectedGame];
                                const assets = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$games$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["gameAssets"][selectedGame];
                                if (!gameData || !assets) return null;
                                const hasVideo = assets.video !== null;
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "relative aspect-video bg-black",
                                            children: hasVideo ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                                                src: assets.video,
                                                autoPlay: true,
                                                loop: true,
                                                muted: true,
                                                playsInline: true,
                                                className: "w-full h-full object-cover rounded-t-[20px]"
                                            }, void 0, false, {
                                                fileName: "[project]/components/sections/Games.tsx",
                                                lineNumber: 216,
                                                columnNumber: 25
                                            }, this) : assets && 'popup' in assets && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                                src: assets.popup,
                                                alt: gameData.name,
                                                fill: true,
                                                className: "object-cover rounded-t-[20px]",
                                                unoptimized: true
                                            }, void 0, false, {
                                                fileName: "[project]/components/sections/Games.tsx",
                                                lineNumber: 226,
                                                columnNumber: 27
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/sections/Games.tsx",
                                            lineNumber: 214,
                                            columnNumber: 21
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            style: {
                                                padding: '2rem'
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "font-display text-3xl font-bold gradient-text mb-4",
                                                    children: gameData.name
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Games.tsx",
                                                    lineNumber: 239,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "mb-6 leading-relaxed",
                                                    style: {
                                                        fontFamily: 'Poppins, sans-serif',
                                                        color: '#ffffff'
                                                    },
                                                    children: gameData.popup_description
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Games.tsx",
                                                    lineNumber: 242,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                    className: "space-y-3",
                                                    children: gameData.features.map((feature, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                            className: "flex items-center gap-3",
                                                            style: {
                                                                fontFamily: 'Poppins, sans-serif',
                                                                color: '#ffffff'
                                                            },
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    style: {
                                                                        width: '8px',
                                                                        height: '8px',
                                                                        backgroundColor: '#00f0ff',
                                                                        borderRadius: '50%',
                                                                        display: 'inline-block',
                                                                        flexShrink: 0,
                                                                        marginRight: '12px'
                                                                    }
                                                                }, void 0, false, {
                                                                    fileName: "[project]/components/sections/Games.tsx",
                                                                    lineNumber: 250,
                                                                    columnNumber: 29
                                                                }, this),
                                                                feature
                                                            ]
                                                        }, i, true, {
                                                            fileName: "[project]/components/sections/Games.tsx",
                                                            lineNumber: 249,
                                                            columnNumber: 27
                                                        }, this))
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Games.tsx",
                                                    lineNumber: 247,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/sections/Games.tsx",
                                            lineNumber: 238,
                                            columnNumber: 21
                                        }, this)
                                    ]
                                }, void 0, true);
                            })()
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/sections/Games.tsx",
                        lineNumber: 184,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/sections/Games.tsx",
                    lineNumber: 177,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/sections/Games.tsx",
                lineNumber: 175,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/sections/Games.tsx",
        lineNumber: 89,
        columnNumber: 5
    }, this);
}
_s(Games, "iYbJi4yKSC+Qz1rUM2Zp6UBF1NY=");
_c = Games;
var _c;
__turbopack_context__.k.register(_c, "Games");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/sections/Pricing.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Pricing
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/users.js [app-client] (ecmascript) <export default as Users>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$party$2d$popper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PartyPopper$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/party-popper.js [app-client] (ecmascript) <export default as PartyPopper>");
'use client';
;
;
function Pricing({ content }) {
    // Détecter la langue
    const isEnglish = !/[א-ת]/.test(content.description);
    // Créer la structure de données EXACTEMENT comme dans main avec les bons prix
    const translations = {
        pricing: {
            title: content.title,
            subtitle: isEnglish ? 'Choose the option that suits you best' : 'בחרו את האפשרות המתאימה לכם',
            single: {
                title: isEnglish ? 'Unlimited Games' : 'משחקים ללא הגבלה',
                price: '100',
                currency: '₪',
                duration: isEnglish ? 'One hour per participant' : 'שעה אחת למשתתף',
                features: [
                    isEnglish ? 'Access to all 8 rooms' : 'גישה לכל 8 החדרים',
                    isEnglish ? 'Unlimited games' : 'משחקים ללא הגבלה',
                    isEnglish ? 'Smart bracelet: 5₪ first-time fee (reusable)' : 'צמיד חכם: 5₪ תשלום ראשוני (לשימוש חוזר)'
                ]
            },
            packages: {
                title: isEnglish ? 'Event Packages' : 'חבילות אירועים',
                items: [
                    {
                        name: isEnglish ? 'Package 15+' : 'חבילת 15+',
                        minParticipants: isEnglish ? 'From 15 participants' : 'החל מ-15 משתתפים',
                        price: '130',
                        currency: isEnglish ? '₪ / person' : '₪ למשתתף',
                        features: [
                            isEnglish ? 'Unlimited games for one hour' : 'משחקים ללא הגבלה שעה אחת',
                            isEnglish ? 'Private event room for 2 hours' : 'חדר אירוע פרטי לשעתיים',
                            isEnglish ? 'Sound and lighting system' : 'הגברה ותאורה',
                            isEnglish ? 'Game tables' : 'שולחנות משחק',
                            isEnglish ? 'Unlimited snacks and drinks' : 'חטיפים ושתייה ללא הגבלה',
                            isEnglish ? 'Two pizza slices per participant' : 'שני משולשי פיצה לכל משתתף'
                        ]
                    },
                    {
                        name: isEnglish ? 'Package 30+' : 'חבילת 30+',
                        minParticipants: isEnglish ? 'From 30 participants' : 'החל מ-30 משתתפים',
                        price: '120',
                        currency: isEnglish ? '₪ / person' : '₪ למשתתף',
                        features: [
                            isEnglish ? 'Unlimited games for one hour' : 'משחקים ללא הגבלה שעה אחת',
                            isEnglish ? 'Private event room for 2 hours' : 'חדר אירוע פרטי לשעתיים',
                            isEnglish ? 'Sound and lighting system' : 'הגברה ותאורה',
                            isEnglish ? 'Game tables' : 'שולחנות משחק',
                            isEnglish ? 'Unlimited snacks and drinks' : 'חטיפים ושתייה ללא הגבלה',
                            isEnglish ? 'Two pizza slices per participant' : 'שני משולשי פיצה לכל משתתף'
                        ]
                    }
                ]
            }
        }
    };
    // Copie EXACTE du composant PricingSection de main
    if (!translations?.pricing) {
        console.error('PricingSection: translations.pricing is missing', translations);
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
            id: "pricing",
            className: "py-20 md:py-32 bg-dark min-h-[600px]",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "container mx-auto px-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-white",
                    children: "Loading translations..."
                }, void 0, false, {
                    fileName: "[project]/components/sections/Pricing.tsx",
                    lineNumber: 71,
                    columnNumber: 123
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/sections/Pricing.tsx",
                lineNumber: 71,
                columnNumber: 83
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/sections/Pricing.tsx",
            lineNumber: 71,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        id: "pricing",
        className: "py-10 md:py-16 min-h-[600px] w-full relative overflow-hidden",
        style: {
            background: 'linear-gradient(135deg, rgba(255, 0, 229, 0.7) 0%, rgba(255, 0, 255, 0.6) 25%, rgba(255, 50, 200, 0.7) 50%, rgba(255, 0, 255, 0.6) 75%, rgba(255, 0, 229, 0.8) 100%)',
            borderRadius: '28px',
            boxShadow: '0px 0px 40px 0px rgba(0, 0, 0, 0.7)',
            marginTop: '0px',
            marginLeft: 'clamp(16px, 2vw, 40px)',
            marginRight: 'clamp(16px, 2vw, 40px)'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute top-0 left-0 right-0",
                style: {
                    transform: 'translateY(-100%)'
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                    viewBox: "0 0 1200 120",
                    preserveAspectRatio: "none",
                    style: {
                        width: '100%',
                        height: '60px',
                        display: 'block'
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: "M0,60 Q300,20 600,60 T1200,60 L1200,120 L0,120 Z",
                        fill: "rgba(255, 0, 229, 0.7)"
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Pricing.tsx",
                        lineNumber: 86,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/sections/Pricing.tsx",
                    lineNumber: 85,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/sections/Pricing.tsx",
                lineNumber: 84,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 opacity-95",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-1/3 left-1/4 w-[700px] h-[700px] rounded-full blur-[250px] animate-pulse",
                        style: {
                            backgroundColor: 'rgba(255, 0, 255, 0.6)',
                            animationDuration: '4s'
                        }
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Pricing.tsx",
                        lineNumber: 92,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute bottom-1/3 right-1/4 w-[700px] h-[700px] rounded-full blur-[250px] animate-pulse",
                        style: {
                            backgroundColor: 'rgba(255, 0, 255, 0.5)',
                            animationDuration: '5s',
                            animationDelay: '1s'
                        }
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Pricing.tsx",
                        lineNumber: 93,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full blur-[350px]",
                        style: {
                            backgroundColor: 'rgba(255, 0, 255, 0.4)'
                        }
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Pricing.tsx",
                        lineNumber: 94,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/sections/Pricing.tsx",
                lineNumber: 91,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "container mx-auto px-4 relative z-10",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-center mb-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "section-title",
                                children: translations.pricing.title
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Pricing.tsx",
                                lineNumber: 100,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "max-w-2xl mx-auto text-lg",
                                style: {
                                    fontFamily: 'Poppins, sans-serif',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                    color: '#ffffff'
                                },
                                children: translations.pricing.subtitle
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Pricing.tsx",
                                lineNumber: 101,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/sections/Pricing.tsx",
                        lineNumber: 99,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-auto mb-16",
                        style: {
                            maxWidth: '320px'
                        },
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "backdrop-blur-sm text-center transition-all duration-300",
                            style: {
                                backgroundColor: 'rgba(26, 26, 46, 0.5)',
                                borderRadius: '16px',
                                border: '2px solid rgba(0, 240, 255, 0.3)',
                                boxShadow: '0 4px 20px rgba(0, 240, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                padding: '1.5rem'
                            },
                            onMouseEnter: (e)=>{
                                e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.6)';
                                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 240, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            },
                            onMouseLeave: (e)=>{
                                e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.3)';
                                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 240, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            },
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                                    className: "w-10 h-10 mx-auto mb-4",
                                    style: {
                                        color: '#08F7FE',
                                        filter: 'drop-shadow(0 0 8px rgba(8, 247, 254, 0.8))'
                                    }
                                }, void 0, false, {
                                    fileName: "[project]/components/sections/Pricing.tsx",
                                    lineNumber: 109,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                    className: "text-2xl font-bold mb-2",
                                    style: {
                                        fontFamily: 'Poppins, sans-serif',
                                        color: '#ffffff'
                                    },
                                    children: translations.pricing.single.title
                                }, void 0, false, {
                                    fileName: "[project]/components/sections/Pricing.tsx",
                                    lineNumber: 110,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mb-6",
                                    style: {
                                        fontFamily: 'Poppins, sans-serif',
                                        color: '#ffffff'
                                    },
                                    children: translations.pricing.single.duration
                                }, void 0, false, {
                                    fileName: "[project]/components/sections/Pricing.tsx",
                                    lineNumber: 111,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center justify-center gap-2 mb-6",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-5xl font-display font-bold",
                                            style: {
                                                color: '#ffffff'
                                            },
                                            children: translations.pricing.single.price
                                        }, void 0, false, {
                                            fileName: "[project]/components/sections/Pricing.tsx",
                                            lineNumber: 114,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-2xl",
                                            style: {
                                                fontFamily: 'Poppins, sans-serif',
                                                color: '#ffffff'
                                            },
                                            children: translations.pricing.single.currency
                                        }, void 0, false, {
                                            fileName: "[project]/components/sections/Pricing.tsx",
                                            lineNumber: 117,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/sections/Pricing.tsx",
                                    lineNumber: 113,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                    className: "space-y-3",
                                    children: translations.pricing.single.features.map((feature, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            className: "flex items-center gap-3 justify-start",
                                            style: {
                                                fontFamily: 'Poppins, sans-serif',
                                                color: '#ffffff'
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                    size: 18,
                                                    className: "flex-shrink-0",
                                                    style: {
                                                        color: '#08F7FE',
                                                        filter: 'drop-shadow(0 0 4px rgba(8, 247, 254, 0.8))'
                                                    }
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Pricing.tsx",
                                                    lineNumber: 123,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    style: {
                                                        color: '#ffffff'
                                                    },
                                                    children: feature
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Pricing.tsx",
                                                    lineNumber: 124,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, i, true, {
                                            fileName: "[project]/components/sections/Pricing.tsx",
                                            lineNumber: 122,
                                            columnNumber: 17
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/components/sections/Pricing.tsx",
                                    lineNumber: 120,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/sections/Pricing.tsx",
                            lineNumber: 108,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Pricing.tsx",
                        lineNumber: 107,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-center mb-8",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-center gap-3 mb-8",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$party$2d$popper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PartyPopper$3e$__["PartyPopper"], {
                                        className: "w-8 h-8",
                                        style: {
                                            color: '#08F7FE',
                                            filter: 'drop-shadow(0 0 8px rgba(8, 247, 254, 0.8))'
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/components/sections/Pricing.tsx",
                                        lineNumber: 134,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-3xl font-bold",
                                        style: {
                                            fontFamily: 'Poppins, sans-serif',
                                            color: '#ffffff'
                                        },
                                        children: translations.pricing.packages.title
                                    }, void 0, false, {
                                        fileName: "[project]/components/sections/Pricing.tsx",
                                        lineNumber: 135,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/sections/Pricing.tsx",
                                lineNumber: 133,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-2 gap-4 mx-auto",
                                style: {
                                    maxWidth: '650px'
                                },
                                children: translations.pricing.packages.items.map((pkg, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "backdrop-blur-sm transition-all duration-300",
                                        style: {
                                            backgroundColor: 'rgba(26, 26, 46, 0.5)',
                                            borderRadius: '16px',
                                            border: '2px solid rgba(0, 240, 255, 0.3)',
                                            boxShadow: '0 4px 20px rgba(0, 240, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                                            padding: '1.5rem'
                                        },
                                        onMouseEnter: (e)=>{
                                            e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.6)';
                                            e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 240, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        },
                                        onMouseLeave: (e)=>{
                                            e.currentTarget.style.borderColor = 'rgba(0, 240, 255, 0.3)';
                                            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 240, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        },
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-2 justify-center mb-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"], {
                                                        className: "w-5 h-5",
                                                        style: {
                                                            color: '#08F7FE',
                                                            filter: 'drop-shadow(0 0 4px rgba(8, 247, 254, 0.8))'
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Pricing.tsx",
                                                        lineNumber: 148,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif',
                                                            color: '#ffffff'
                                                        },
                                                        children: pkg.minParticipants
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Pricing.tsx",
                                                        lineNumber: 149,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/sections/Pricing.tsx",
                                                lineNumber: 147,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center justify-center gap-2 mb-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-4xl font-display font-bold",
                                                        style: {
                                                            color: '#ffffff'
                                                        },
                                                        children: pkg.price
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Pricing.tsx",
                                                        lineNumber: 153,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-xl",
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif',
                                                            color: '#ffffff'
                                                        },
                                                        children: pkg.currency
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Pricing.tsx",
                                                        lineNumber: 156,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/sections/Pricing.tsx",
                                                lineNumber: 152,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                className: "space-y-2 text-start",
                                                children: pkg.features.map((feature, i)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                                        className: "flex items-start gap-2 text-sm",
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif',
                                                            color: '#ffffff'
                                                        },
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                                size: 16,
                                                                className: "flex-shrink-0 mt-0.5",
                                                                style: {
                                                                    color: '#08F7FE',
                                                                    filter: 'drop-shadow(0 0 4px rgba(8, 247, 254, 0.8))'
                                                                }
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/sections/Pricing.tsx",
                                                                lineNumber: 162,
                                                                columnNumber: 23
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                style: {
                                                                    color: '#ffffff'
                                                                },
                                                                children: feature
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/sections/Pricing.tsx",
                                                                lineNumber: 163,
                                                                columnNumber: 23
                                                            }, this)
                                                        ]
                                                    }, i, true, {
                                                        fileName: "[project]/components/sections/Pricing.tsx",
                                                        lineNumber: 161,
                                                        columnNumber: 21
                                                    }, this))
                                            }, void 0, false, {
                                                fileName: "[project]/components/sections/Pricing.tsx",
                                                lineNumber: 159,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, index, true, {
                                        fileName: "[project]/components/sections/Pricing.tsx",
                                        lineNumber: 140,
                                        columnNumber: 15
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Pricing.tsx",
                                lineNumber: 138,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/sections/Pricing.tsx",
                        lineNumber: 132,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/sections/Pricing.tsx",
                lineNumber: 97,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute bottom-0 left-0 right-0",
                style: {
                    transform: 'translateY(100%)'
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                    viewBox: "0 0 1200 120",
                    preserveAspectRatio: "none",
                    style: {
                        width: '100%',
                        height: '60px',
                        display: 'block'
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: "M0,0 Q300,40 600,0 T1200,0 L1200,120 L0,120 Z",
                        fill: "rgba(0, 240, 255, 0.7)"
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Pricing.tsx",
                        lineNumber: 176,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/sections/Pricing.tsx",
                    lineNumber: 175,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/sections/Pricing.tsx",
                lineNumber: 174,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/sections/Pricing.tsx",
        lineNumber: 75,
        columnNumber: 5
    }, this);
}
_c = Pricing;
var _c;
__turbopack_context__.k.register(_c, "Pricing");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/sections/Contact.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Contact
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/send.js [app-client] (ecmascript) <export default as Send>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/mail.js [app-client] (ecmascript) <export default as Mail>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$phone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Phone$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/phone.js [app-client] (ecmascript) <export default as Phone>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/map-pin.js [app-client] (ecmascript) <export default as MapPin>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Building$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/building.js [app-client] (ecmascript) <export default as Building>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function Contact({ content }) {
    _s();
    const [formData, setFormData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        name: '',
        email: '',
        message: ''
    });
    const handleSubmit = (e)=>{
        e.preventDefault();
        console.log('Form submitted:', formData);
    };
    // Parser l'adresse (format: "line1\nline2")
    const addressLines = content.address.split('\n');
    const address = addressLines[0] || content.address;
    const venue = addressLines[1] || '';
    // Détecter la langue
    const isEnglish = !/[א-ת]/.test(content.title);
    const formLabels = isEnglish ? {
        name: 'Name',
        email: 'Email',
        message: 'Message',
        send: 'Send'
    } : {
        name: 'שם',
        email: 'אימייל',
        message: 'הודעה',
        send: 'שלח'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        id: "contact",
        className: "py-10 md:py-16 relative overflow-hidden",
        style: {
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.7) 0%, rgba(0, 240, 255, 0.6) 25%, rgba(0, 200, 255, 0.7) 50%, rgba(0, 240, 255, 0.6) 75%, rgba(0, 240, 255, 0.8) 100%)'
        },
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute top-0 left-0 right-0",
                style: {
                    transform: 'translateY(-100%)'
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                    viewBox: "0 0 1200 120",
                    preserveAspectRatio: "none",
                    style: {
                        width: '100%',
                        height: '60px',
                        display: 'block'
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                        d: "M0,60 Q300,20 600,60 T1200,60 L1200,120 L0,120 Z",
                        fill: "rgba(0, 240, 255, 0.7)"
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Contact.tsx",
                        lineNumber: 48,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/sections/Contact.tsx",
                    lineNumber: 47,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/sections/Contact.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 opacity-95",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-0 right-1/4 w-[700px] h-[700px] bg-primary/60 rounded-full blur-[250px] animate-pulse",
                        style: {
                            animationDuration: '4s',
                            animationDelay: '1s'
                        }
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Contact.tsx",
                        lineNumber: 54,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute bottom-0 left-1/4 w-[700px] h-[700px] bg-primary/50 rounded-full blur-[250px] animate-pulse",
                        style: {
                            animationDuration: '5s'
                        }
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Contact.tsx",
                        lineNumber: 55,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-primary/40 rounded-full blur-[350px]"
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Contact.tsx",
                        lineNumber: 56,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/sections/Contact.tsx",
                lineNumber: 53,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "container mx-auto px-4 relative z-10",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                        initial: {
                            opacity: 0,
                            y: 20
                        },
                        whileInView: {
                            opacity: 1,
                            y: 0
                        },
                        viewport: {
                            once: true
                        },
                        className: "text-center mb-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                className: "section-title",
                                children: content.title
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Contact.tsx",
                                lineNumber: 67,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-white max-w-2xl mx-auto text-lg",
                                style: {
                                    fontFamily: 'Poppins, sans-serif',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                },
                                children: content.description
                            }, void 0, false, {
                                fileName: "[project]/components/sections/Contact.tsx",
                                lineNumber: 68,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/sections/Contact.tsx",
                        lineNumber: 61,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "max-w-6xl mx-auto",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-1 lg:grid-cols-2 gap-12 items-center",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                    initial: {
                                        opacity: 0,
                                        x: -30
                                    },
                                    whileInView: {
                                        opacity: 1,
                                        x: 0
                                    },
                                    viewport: {
                                        once: true
                                    },
                                    className: "space-y-6 w-full",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-start gap-4 p-4 bg-dark-100/90 backdrop-blur-sm rounded-xl border border-primary/30 hover:border-primary/50 transition-all duration-300",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$map$2d$pin$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MapPin$3e$__["MapPin"], {
                                                        className: "w-6 h-6 text-primary"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 85,
                                                        columnNumber: 19
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Contact.tsx",
                                                    lineNumber: 84,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-white font-medium",
                                                            style: {
                                                                fontFamily: 'Poppins, sans-serif'
                                                            },
                                                            children: address
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/sections/Contact.tsx",
                                                            lineNumber: 88,
                                                            columnNumber: 19
                                                        }, this),
                                                        venue && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-gray-400 text-sm mt-1",
                                                            style: {
                                                                fontFamily: 'Poppins, sans-serif'
                                                            },
                                                            children: venue
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/sections/Contact.tsx",
                                                            lineNumber: 89,
                                                            columnNumber: 29
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/sections/Contact.tsx",
                                                    lineNumber: 87,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/sections/Contact.tsx",
                                            lineNumber: 83,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                            href: `tel:${content.phone.replace(/\s/g, '')}`,
                                            className: "flex items-center gap-4 p-4 bg-dark-100/90 backdrop-blur-sm rounded-xl border border-secondary/30 hover:border-secondary/50 transition-all duration-300 group",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "w-12 h-12 bg-secondary/20 rounded-full flex items-center justify-center group-hover:bg-secondary/30 transition-colors",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$phone$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Phone$3e$__["Phone"], {
                                                        className: "w-6 h-6 text-secondary"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 99,
                                                        columnNumber: 19
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Contact.tsx",
                                                    lineNumber: 98,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-gray-400 text-sm",
                                                            style: {
                                                                fontFamily: 'Poppins, sans-serif'
                                                            },
                                                            children: "Phone"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/sections/Contact.tsx",
                                                            lineNumber: 102,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-white font-medium text-lg",
                                                            style: {
                                                                fontFamily: 'Poppins, sans-serif'
                                                            },
                                                            children: content.phone
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/sections/Contact.tsx",
                                                            lineNumber: 103,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/sections/Contact.tsx",
                                                    lineNumber: 101,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/sections/Contact.tsx",
                                            lineNumber: 94,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                            href: `mailto:${content.email}`,
                                            className: "flex items-center gap-4 p-4 bg-dark-100/90 backdrop-blur-sm rounded-xl border border-primary/30 hover:border-primary/50 transition-all duration-300 group",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center group-hover:bg-primary/30 transition-colors",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$mail$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Mail$3e$__["Mail"], {
                                                        className: "w-6 h-6 text-primary"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 113,
                                                        columnNumber: 19
                                                    }, this)
                                                }, void 0, false, {
                                                    fileName: "[project]/components/sections/Contact.tsx",
                                                    lineNumber: 112,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-gray-400 text-sm",
                                                            style: {
                                                                fontFamily: 'Poppins, sans-serif'
                                                            },
                                                            children: "Email"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/sections/Contact.tsx",
                                                            lineNumber: 116,
                                                            columnNumber: 19
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                            className: "text-white font-medium",
                                                            style: {
                                                                fontFamily: 'Poppins, sans-serif'
                                                            },
                                                            children: content.email
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/sections/Contact.tsx",
                                                            lineNumber: 117,
                                                            columnNumber: 19
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/sections/Contact.tsx",
                                                    lineNumber: 115,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/sections/Contact.tsx",
                                            lineNumber: 108,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "pt-6 border-t border-dark-200",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: "http://www.laser-city.co.il",
                                                target: "_blank",
                                                rel: "noopener noreferrer",
                                                className: "flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Building$3e$__["Building"], {
                                                        className: "w-5 h-5 text-white"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 129,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-white text-sm",
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif',
                                                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                                        },
                                                        children: "Powered by Laser City"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 130,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/sections/Contact.tsx",
                                                lineNumber: 123,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/sections/Contact.tsx",
                                            lineNumber: 122,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/sections/Contact.tsx",
                                    lineNumber: 76,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                                    initial: {
                                        opacity: 0,
                                        x: 30
                                    },
                                    whileInView: {
                                        opacity: 1,
                                        x: 0
                                    },
                                    viewport: {
                                        once: true
                                    },
                                    className: "w-full",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                                        onSubmit: handleSubmit,
                                        className: "space-y-6",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        htmlFor: "name",
                                                        className: "block text-white mb-2 text-sm",
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif',
                                                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                                        },
                                                        children: formLabels.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 145,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "text",
                                                        id: "name",
                                                        value: formData.name,
                                                        onChange: (e)=>setFormData({
                                                                ...formData,
                                                                name: e.target.value
                                                            }),
                                                        className: "form-input bg-dark-100/90 backdrop-blur-sm border-primary/30",
                                                        required: true,
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif'
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 148,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/sections/Contact.tsx",
                                                lineNumber: 144,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        htmlFor: "email",
                                                        className: "block text-white mb-2 text-sm",
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif',
                                                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                                        },
                                                        children: formLabels.email
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 161,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "email",
                                                        id: "email",
                                                        value: formData.email,
                                                        onChange: (e)=>setFormData({
                                                                ...formData,
                                                                email: e.target.value
                                                            }),
                                                        className: "form-input bg-dark-100/90 backdrop-blur-sm border-primary/30",
                                                        required: true,
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif'
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 164,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/sections/Contact.tsx",
                                                lineNumber: 160,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                        htmlFor: "message",
                                                        className: "block text-white mb-2 text-sm",
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif',
                                                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                                        },
                                                        children: formLabels.message
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 177,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
                                                        id: "message",
                                                        value: formData.message,
                                                        onChange: (e)=>setFormData({
                                                                ...formData,
                                                                message: e.target.value
                                                            }),
                                                        rows: 5,
                                                        className: "form-input bg-dark-100/90 backdrop-blur-sm border-primary/30 resize-none",
                                                        required: true,
                                                        style: {
                                                            fontFamily: 'Poppins, sans-serif'
                                                        }
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/sections/Contact.tsx",
                                                        lineNumber: 180,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/sections/Contact.tsx",
                                                lineNumber: 176,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex justify-center",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                    type: "submit",
                                                    className: "glow-button w-auto px-8 flex items-center justify-center gap-2 text-dark font-semibold",
                                                    style: {
                                                        fontFamily: 'Poppins, sans-serif'
                                                    },
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$send$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Send$3e$__["Send"], {
                                                            size: 18
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/sections/Contact.tsx",
                                                            lineNumber: 198,
                                                            columnNumber: 21
                                                        }, this),
                                                        formLabels.send
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/sections/Contact.tsx",
                                                    lineNumber: 193,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/components/sections/Contact.tsx",
                                                lineNumber: 192,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/sections/Contact.tsx",
                                        lineNumber: 142,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/sections/Contact.tsx",
                                    lineNumber: 136,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/sections/Contact.tsx",
                            lineNumber: 74,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/sections/Contact.tsx",
                        lineNumber: 73,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/sections/Contact.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/sections/Contact.tsx",
        lineNumber: 42,
        columnNumber: 5
    }, this);
}
_s(Contact, "cRGivdu4kk0x+g1ddJGmIV4n560=");
_c = Contact;
var _c;
__turbopack_context__.k.register(_c, "Contact");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/Footer.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Footer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
'use client';
;
;
;
function Footer({ content }) {
    // Prendre les 8 premiers jeux (exclure control si présent)
    const gameNames = content.games.items.filter((g)=>!g.name.toLowerCase().includes('control')).slice(0, 8);
    // Détecter la langue
    const isEnglish = !/[א-ת]/.test(content.concept.title);
    const footerTitles = isEnglish ? {
        games: 'OUR GAMES',
        concept: 'CONCEPT',
        pricing: 'PRICING',
        contact: 'Contact',
        navigation: 'Navigation'
    } : {
        games: 'המשחקים שלנו',
        concept: 'קונספט',
        pricing: 'מחירים',
        contact: 'צור קשר',
        navigation: 'ניווט'
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("footer", {
        className: "bg-dark border-t border-dark-200 py-12",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "container mx-auto px-4",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-1 md:grid-cols-4 gap-8",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    href: "/",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                        src: "/images/Logo-1.png",
                                        alt: "Active Games",
                                        width: 150,
                                        height: 40,
                                        className: "h-10 w-auto",
                                        unoptimized: true
                                    }, void 0, false, {
                                        fileName: "[project]/components/Footer.tsx",
                                        lineNumber: 37,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/Footer.tsx",
                                    lineNumber: 36,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                    href: "http://www.laser-city.co.il",
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                    className: "block opacity-60 hover:opacity-100 transition-opacity",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-gray-500 text-xs",
                                            children: "Powered by"
                                        }, void 0, false, {
                                            fileName: "[project]/components/Footer.tsx",
                                            lineNumber: 52,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-gray-400 text-sm font-medium",
                                            children: "Laser City"
                                        }, void 0, false, {
                                            fileName: "[project]/components/Footer.tsx",
                                            lineNumber: 53,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/Footer.tsx",
                                    lineNumber: 46,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/Footer.tsx",
                            lineNumber: 35,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                    className: "text-white font-bold mb-4 text-sm uppercase tracking-wider",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                        href: "#games",
                                        className: "hover:text-primary transition-colors",
                                        children: footerTitles.games
                                    }, void 0, false, {
                                        fileName: "[project]/components/Footer.tsx",
                                        lineNumber: 60,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/Footer.tsx",
                                    lineNumber: 59,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                    className: "space-y-2",
                                    children: gameNames.slice(0, 4).map((game, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: "#games",
                                                className: "text-gray-400 hover:text-primary transition-colors text-sm",
                                                children: game.name
                                            }, void 0, false, {
                                                fileName: "[project]/components/Footer.tsx",
                                                lineNumber: 67,
                                                columnNumber: 19
                                            }, this)
                                        }, index, false, {
                                            fileName: "[project]/components/Footer.tsx",
                                            lineNumber: 66,
                                            columnNumber: 17
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/components/Footer.tsx",
                                    lineNumber: 64,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/Footer.tsx",
                            lineNumber: 58,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                    className: "text-white font-bold mb-4 text-sm uppercase tracking-wider opacity-0",
                                    children: "More"
                                }, void 0, false, {
                                    fileName: "[project]/components/Footer.tsx",
                                    lineNumber: 80,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                    className: "space-y-2",
                                    children: gameNames.slice(4).map((game, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: "#games",
                                                className: "text-gray-400 hover:text-primary transition-colors text-sm",
                                                children: game.name
                                            }, void 0, false, {
                                                fileName: "[project]/components/Footer.tsx",
                                                lineNumber: 86,
                                                columnNumber: 19
                                            }, this)
                                        }, index, false, {
                                            fileName: "[project]/components/Footer.tsx",
                                            lineNumber: 85,
                                            columnNumber: 17
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/components/Footer.tsx",
                                    lineNumber: 83,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/Footer.tsx",
                            lineNumber: 79,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                    className: "text-white font-bold mb-4 text-sm uppercase tracking-wider",
                                    children: footerTitles.navigation
                                }, void 0, false, {
                                    fileName: "[project]/components/Footer.tsx",
                                    lineNumber: 99,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                    className: "space-y-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: "#concept",
                                                className: "text-gray-400 hover:text-primary transition-colors text-sm",
                                                children: content.concept.title
                                            }, void 0, false, {
                                                fileName: "[project]/components/Footer.tsx",
                                                lineNumber: 104,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/Footer.tsx",
                                            lineNumber: 103,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: "#pricing",
                                                className: "text-gray-400 hover:text-primary transition-colors text-sm",
                                                children: content.pricing.title
                                            }, void 0, false, {
                                                fileName: "[project]/components/Footer.tsx",
                                                lineNumber: 112,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/Footer.tsx",
                                            lineNumber: 111,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: "#contact",
                                                className: "text-gray-400 hover:text-primary transition-colors text-sm",
                                                children: footerTitles.contact
                                            }, void 0, false, {
                                                fileName: "[project]/components/Footer.tsx",
                                                lineNumber: 120,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/Footer.tsx",
                                            lineNumber: 119,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/Footer.tsx",
                                    lineNumber: 102,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/Footer.tsx",
                            lineNumber: 98,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/Footer.tsx",
                    lineNumber: 33,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "border-t border-dark-200 mt-8 pt-8 text-center",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-gray-500 text-sm",
                        children: [
                            "© ",
                            new Date().getFullYear(),
                            " Active Games Rishon LeZion. All rights reserved."
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/Footer.tsx",
                        lineNumber: 133,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/Footer.tsx",
                    lineNumber: 132,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/Footer.tsx",
            lineNumber: 32,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/Footer.tsx",
        lineNumber: 31,
        columnNumber: 5
    }, this);
}
_c = Footer;
var _c;
__turbopack_context__.k.register(_c, "Footer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/content.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getContent",
    ()=>getContent
]);
const contentEn = {
    hero: {
        title: 'Active Games',
        subtitle: 'New generation leisure activities\n\nFully immersive interactive arenas, where neon lighting, sound, and physical challenges combine to create unique experiences.',
        cta1: 'Discover our games',
        cta2: 'Discover the concept'
    },
    concept: {
        title: 'About the Game',
        description: `Active Games is a new generation of interactive team challenges, combining physical movement, strategy, and smart technology.

The experience is designed for teams of up to 6 players and lasts 60 minutes of intense action and fun.

From the moment you arrive, each player receives a personal wristband and registers with their name. This wristband tracks your progress, scores, and achievements throughout the entire experience.
Before entering each room, your team scans the wristband to activate the game. Every decision matters — every room, every challenge, every second counts.

The arena features 8 different rooms, each with its own atmosphere, concept, and unique challenges. Every room offers multiple games with several difficulty levels, allowing each team to choose what suits them best.
You can play in competitive mode or team mode — challenge your friends, play together with partners, or compete head-to-head to climb the leaderboard.
There is no fixed path and no predefined order. You choose your strategy, your pace, and your challenges, aiming to score as many points as possible.

Active Games is a dynamic, immersive, and adrenaline-filled experience — where speed, teamwork, and smart decisions are the key to victory.`
    },
    games: {
        title: 'OUR GAMES',
        subtitle: 'Each game offers a unique experience combining fun, challenge, and physical engagement. Reflexes, coordination, or cooperation: choose your style and dive into the action.',
        items: [
            {
                name: 'Grid',
                description: 'Is a revolutionary interactive flooring system with built-in RGB LED lights and sensors. Designed for gyms, malls, play zones, and theme parks, it creates a dynamic and immersive experience suitable for all ages.',
                video: '/videos/Grille-active-games.mp4'
            },
            {
                name: 'Arena',
                description: 'The ultimate dodgeball LED target wall game. Test speed, accuracy & memory with real-time scoring, tournaments & team challenges',
                video: '/videos/Video-sans-titre-‐-Realisee-avec-Clipchamp-2.mp4'
            },
            {
                name: 'Push',
                description: 'In this room, the walls are filled with buttons that can change different colors, with various game modes that test color recognition and memory abilities, as well as electric current relay and pk game.',
                video: '/videos/PUSH.mp4'
            },
            {
                name: 'Hoops Basketball',
                description: 'An interactive basketball fitness game that combines fun, exercise, and technology—perfect for gyms, homes, and entertainment centers.',
                video: '/videos/Hoops-Basketball.mp4'
            },
            {
                name: 'Climbing',
                description: 'An interactive LED wall designed to test your agility, strategy, and team fun. This attraction combines physical movement with quick thinking.',
                video: '/videos/climb.mp4'
            },
            {
                name: 'Hide Game Room',
                description: 'Cooperate with your friends to complete tasks, avoid the sensors\' detection. Interactive technology with real-time reactions, ensuring an adrenaline filled adventure.',
                video: '/videos/hide-activate.mp4'
            },
            {
                name: 'Flash',
                description: 'Two or more players are required to cooperate. Press the circular light before the randomly decreasing current reaches the target circular light. The current will return and be randomly sent to other players. The higher the level, the faster the current speed.',
                video: '/videos/flash.mp4'
            },
            {
                name: 'Laser',
                description: 'Is a thrilling escape room experience where players dodge laser beams by running, jumping, crawling, and rolling. With multiple game modes.',
                video: '/videos/laser.mp4'
            },
            {
                name: 'Control',
                description: 'In Control, players stand in front of the console and control the movement of the light blocks by tapping the buttons on the console or stepping on the LED tiles.',
                video: '/videos/control.mp4'
            }
        ]
    },
    pricing: {
        title: 'PRICING',
        description: `Unlimited games – 1 Hour – ₪120 per player

Groupe - Events
From 15 participants – ₪130 per player
From 30 participants – ₪120 per player

• Unlimited games for one hour
• Private event room for two hours
• Sound system and lighting
• Game tables
• Unlimited snacks and drinks
• Two slices of pizza per participant`
    },
    contact: {
        title: 'Contact us',
        description: 'Contact us for any further information or specific inquiries.',
        address: 'Aliyat ha-No\'ar St 1, Rishon LeZion\nInside LASER CITY, 5th Floor',
        email: 'contact@activegames.co.il',
        phone: '03 551-2277',
        whatsapp: '+972586266770'
    }
};
const contentHe = {
    hero: {
        title: 'אקטיב גיימס',
        subtitle: 'פעילויות פנאי דור חדש\n\nזירות אינטראקטיביות סוחפות לחלוטין, שבהן תאורת ניאון, סאונד ואתגרים פיזיים מתחברים ליצירת חוויות ייחודיות.',
        cta1: 'גלו את הקונספט',
        cta2: 'גלו את המשחקים שלנו'
    },
    concept: {
        title: 'על המשחק',
        description: `אקטיב גיימס הוא מתחם משחקים אינטראקטיבי חדשני המבוסס על עבודת צוות, תנועה וחשיבה אסטרטגית.

החוויה מיועדת לקבוצות של עד 6 שחקנים,נהלת לאורך 60 דקות של אקשן.

עם ההגעה, כל שחקן מקבל צמיד חכם ונרשם עם שמו. הצמיד מזהה אתכם לאורך כל המשחק – כל נקודה, כל הישג וכל אתגר נשמרים עליו.
לפני הכניסה לכל חדר, הקבוצה סורקת את הצמיד, והמערכת מזהה אוטומטית את המשתתפים ומפעילה את המשחק הנבחר.

המתחם כולל 8 חדרים שונים, כל אחד עם עולם, קונספט ואתגרים ייחודיים. בכל חדר מחכים מספר משחקים עם רמות קושי משתנות, כך שכל קבוצה יכולה לבחור את האתגרים המתאימים לה.
ניתן לשחק במצב תחרותי או במצב קבוצתי – להתמודד אחד נגד השני או לשתף פעולה עם חברים ושותפים, ולבחור בכל משחק אם לשחק כיריבים או כצוות אחד.
אין מסלול קבוע ואין סדר מחייב – אתם בוחרים לאן להיכנס, מתי להחליף חדר ואיזו אסטרטגיה תוביל אתכם לצבירת מקסימום נקודות.

אקטיב גיימס היא חוויה דינמית, סוחפת ומלאת אדרנלין, שבה שיתוף פעולה, מהירות וחשיבה חדה הם המפתח לניצחון.`
    },
    games: {
        title: 'המשחקים שלנו',
        subtitle: 'כל משחק מציע חוויה ייחודית שמשלבת הנאה אתגר ומעורבות פיזית, רפלקסים תיאום או שיתוף פעולה. בחר את הסגנון שלך וצא לפעולה:',
        items: [
            {
                name: 'גריד',
                description: 'גריד הוא מערכת רצפה אינטראקטיבית מהפכנית עם תאורת LED RGB וחיישנים מובנים. המערכת מיועדת לחדרי כושר קניונים מתחמי משחק ופארקי נושא. היא יוצרת חוויה דינמית וסוחפת שמתאימה לכל גיל.',
                video: '/videos/Grille-active-games.mp4'
            },
            {
                name: 'ארינה',
                description: 'משחק היעדים האולטימטיבי בכדור־העף־נמנע עם קיר LED. בחן מהירות דיוק וזיכרון עם ניקוד בזמן אמת. טורנירים ואתגרי צוות.',
                video: '/videos/Video-sans-titre-‐-Realisee-avec-Clipchamp-2.mp4'
            },
            {
                name: 'פוש',
                description: 'בחדר הזה הקירות מלאים בכפתורים שיכולים להחליף צבעים. יש מגוון מצבי משחק שבודקים זיהוי צבעים ויכולות זיכרון. בנוסף יש משחקי זרם חשמלי ומשחק PK.',
                video: '/videos/PUSH.mp4'
            },
            {
                name: 'הופס בסקטבול',
                description: 'משחק כדורסל אינטראקטיבי שמשלב כיף פעילות גופנית וטכנולוגיה. מושלם לחדרי כושר בתים ומרכזי בידור.',
                video: '/videos/Hoops-Basketball.mp4'
            },
            {
                name: 'טיפוס',
                description: 'קיר LED אינטראקטיבי שנועד לבדוק זריזות אסטרטגיה ועבודת צוות. האטרקציה משלבת תנועה פיזית עם חשיבה מהירה.',
                video: '/videos/climb.mp4'
            },
            {
                name: 'חדר מחבואים דיגיטל',
                description: 'בחדר הזה עיני חישה עוקבות אחרי כל תנועה שלך. השתמש בעמודים אסטרטגיים למחסה השלם רצפי אור, ועבוד עם הצוות שלך כדי לנצח.',
                video: '/videos/hide-activate.mp4'
            },
            {
                name: 'פלאש',
                description: 'שני שחקנים או יותר צריכים לשתף פעולה. לחץ על מעגל האור לפני שהזרם היורד באקראיות מגיע למעגל היעד.הזרם יחזור ויעבור באקראיות לשחקנים אחרים. ככל שהרמה גבוהה יותר כך מהירות הזרם מהירה יותר',
                video: '/videos/flash.mp4'
            },
            {
                name: 'לייזר',
                description: 'חוויה מרגשת בסגנון חדר בריחה שבה השחקנים מתחמקים מקרני לייזר. בעזרת ריצה קפיצה זחילה והתגלגלות כולל מגוון מצבי משחק.',
                video: '/videos/laser.mp4'
            },
            {
                name: 'קונטרול',
                description: 'בקונטרול, השחקנים עומדים מול הקונסולה ושולטים בתנועת בלוקי האור על ידי הקשה על הכפתורים בקונסולה או דריכה על אריחי ה-LED.',
                video: '/videos/control.mp4'
            }
        ]
    },
    pricing: {
        title: 'מחיר',
        description: `משחקים ללא הגבלה – שעה אחת – ₪100 למשתתף

חבילות אירועים
החל מ-15 משתתפים – ₪130 למשתתף
החל מ-30 משתתפים – ₪120 למשתתף

• משחקים ללא הגבלה שעה אחת
• חדר אירוע פרטי לשעתיים
• הגברה ותאורה
• שולחנות משחק
• חטיפים ושתייה ללא הגבלה
• שני משולשי פיצה לכל משתתף`
    },
    contact: {
        title: 'צור קשר',
        description: 'צרו איתנו קשר לקבלת מידע נוסף או לשאלות ספציפיות.',
        address: 'עליית הנוער 1, מרכז בר-און – קומה 5 – ראשון לציון\nבמתחם לייזר סיטי',
        email: 'contact@activegames.co.il',
        phone: '03 551-2277',
        whatsapp: '+972586266770'
    }
};
function getContent(locale) {
    return locale === 'he' ? contentHe : contentEn;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/WhatsAppButton.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>WhatsAppButton
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/message-circle.js [app-client] (ecmascript) <export default as MessageCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$content$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/content.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function WhatsAppButton() {
    _s();
    const params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"])();
    const locale = params?.locale === 'he' || params?.locale === 'en' ? params.locale : 'en';
    const content = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$content$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getContent"])(locale);
    const whatsappNumber = content.contact.whatsapp.replace(/\D/g, '');
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
        href: `https://wa.me/${whatsappNumber}`,
        target: "_blank",
        rel: "noopener noreferrer",
        className: "whatsapp-float",
        "aria-label": "Contact us on WhatsApp",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$message$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__MessageCircle$3e$__["MessageCircle"], {
            className: "w-7 h-7",
            style: {
                color: '#ffffff'
            }
        }, void 0, false, {
            fileName: "[project]/components/WhatsAppButton.tsx",
            lineNumber: 21,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/WhatsAppButton.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
_s(WhatsAppButton, "+jVsTcECDRo3yq2d7EQxlN9Ixog=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"]
    ];
});
_c = WhatsAppButton;
var _c;
__turbopack_context__.k.register(_c, "WhatsAppButton");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_4460313e._.js.map