module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[project]/components/Header.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Header
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function Header({ locale }) {
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePathname"])();
    const [isLanguageMenuOpen, setIsLanguageMenuOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isMobile, setIsMobile] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const checkMobile = ()=>{
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setIsMobileMenuOpen(false);
            }
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return ()=>window.removeEventListener('resize', checkMobile);
    }, []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const handleClickOutside = (event)=>{
            if (isMobile && isMobileMenuOpen) {
                const target = event.target;
                if (!target.closest('header') && !target.closest('nav')) {
                    setIsMobileMenuOpen(false);
                }
            }
        };
        if (isMobileMenuOpen) {
            document.addEventListener('click', handleClickOutside);
            return ()=>document.removeEventListener('click', handleClickOutside);
        }
    }, [
        isMobile,
        isMobileMenuOpen
    ]);
    const menuItems = [
        {
            href: '#concept',
            label: locale === 'he' ? 'קונספט' : 'CONCEPT'
        },
        {
            href: '#games',
            label: locale === 'he' ? 'משחקים' : 'GAMES'
        },
        {
            href: '#price',
            label: locale === 'he' ? 'מחיר' : 'PRICING'
        },
        {
            href: '#contact',
            label: locale === 'he' ? 'צור קשר' : 'CONTACT'
        }
    ];
    const getLocalizedPath = (newLocale)=>{
        const pathSegments = pathname.split('/');
        pathSegments[1] = newLocale;
        return pathSegments.join('/');
    };
    const languageOptions = [
        {
            code: 'en',
            flag: '🇺🇸',
            label: 'English'
        },
        {
            code: 'he',
            flag: '🇮🇱',
            label: 'עברית'
        }
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
        className: "fixed top-0 left-0 right-0",
        style: {
            background: 'rgba(26, 26, 46, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(8, 247, 254, 0.3)',
            zIndex: 30,
            height: '65px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
            width: '100%'
        },
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
            style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                height: '65px',
                paddingLeft: 'clamp(20px, 4vw, 60px)',
                paddingRight: 'clamp(20px, 4vw, 60px)',
                position: 'relative',
                maxWidth: '100%',
                boxSizing: 'border-box'
            },
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                    href: `/${locale}`,
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        height: '65px',
                        minWidth: 'fit-content'
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                        src: locale === 'he' ? '/images/logo-empty-active-games-hebrew.png' : '/images/Logo-1.png',
                        alt: "Active Games Logo",
                        style: {
                            height: 'clamp(35px, 5vw, 50px)',
                            width: 'auto',
                            display: 'block',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                            maxWidth: '100%'
                        },
                        onError: (e)=>{
                            console.error('Logo failed to load:', e.currentTarget.src);
                        }
                    }, void 0, false, {
                        fileName: "[project]/components/Header.tsx",
                        lineNumber: 94,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/Header.tsx",
                    lineNumber: 87,
                    columnNumber: 9
                }, this),
                !isMobile && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '0px',
                        height: '65px',
                        marginRight: '0',
                        flexWrap: 'nowrap',
                        flexShrink: 0
                    },
                    children: [
                        menuItems.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: `/${locale}${item.href}`,
                                className: "uppercase transition-all",
                                style: {
                                    fontFamily: 'Roboto, sans-serif',
                                    fontSize: 'clamp(14px, 2vw, 24px)',
                                    fontWeight: 700,
                                    lineHeight: '10px',
                                    letterSpacing: '0.8px',
                                    color: '#05f6f7',
                                    paddingLeft: 'clamp(8px, 1.5vw, 18px)',
                                    paddingRight: 'clamp(8px, 1.5vw, 18px)',
                                    paddingTop: '11px',
                                    paddingBottom: '11px',
                                    position: 'relative',
                                    backgroundImage: 'linear-gradient(to right, #00F0FF, #F000F0)',
                                    backgroundPosition: 'bottom left',
                                    backgroundRepeat: 'no-repeat',
                                    backgroundSize: '0% 3px',
                                    transition: 'background-size 0.3s ease, color 0.3s ease',
                                    textDecoration: 'none',
                                    whiteSpace: 'nowrap'
                                },
                                onMouseEnter: (e)=>{
                                    e.currentTarget.style.backgroundSize = '100% 3px';
                                    e.currentTarget.style.color = '#C7D0FF';
                                },
                                onMouseLeave: (e)=>{
                                    e.currentTarget.style.backgroundSize = '0% 3px';
                                    e.currentTarget.style.color = '#05f6f7';
                                },
                                onClick: (e)=>{
                                    e.preventDefault();
                                    const element = document.querySelector(item.href);
                                    element?.scrollIntoView({
                                        behavior: 'smooth'
                                    });
                                },
                                children: item.label
                            }, item.href, false, {
                                fileName: "[project]/components/Header.tsx",
                                lineNumber: 124,
                                columnNumber: 15
                            }, this)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "relative",
                            style: {
                                marginLeft: '8px'
                            },
                            onMouseEnter: ()=>setIsLanguageMenuOpen(true),
                            onMouseLeave: ()=>setIsLanguageMenuOpen(false),
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>setIsLanguageMenuOpen(!isLanguageMenuOpen),
                                    style: {
                                        backgroundColor: 'transparent',
                                        color: '#05f6f7',
                                        border: 'none',
                                        fontSize: 'clamp(14px, 2vw, 24px)',
                                        fontFamily: 'Roboto, sans-serif',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        padding: '11px clamp(8px, 1.5vw, 18px)',
                                        outline: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'color 0.3s ease'
                                    },
                                    onMouseEnter: (e)=>{
                                        e.currentTarget.style.color = '#C7D0FF';
                                    },
                                    onMouseLeave: (e)=>{
                                        if (!isLanguageMenuOpen) {
                                            e.currentTarget.style.color = '#05f6f7';
                                        }
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: locale === 'en' ? '🇺🇸' : '🇮🇱'
                                        }, void 0, false, {
                                            fileName: "[project]/components/Header.tsx",
                                            lineNumber: 197,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                                            style: {
                                                width: '12px',
                                                height: '12px',
                                                fill: 'currentColor',
                                                transition: 'transform 0.3s ease',
                                                transform: isLanguageMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                                            },
                                            xmlns: "http://www.w3.org/2000/svg",
                                            viewBox: "0 0 20 20",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("path", {
                                                d: "M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"
                                            }, void 0, false, {
                                                fileName: "[project]/components/Header.tsx",
                                                lineNumber: 199,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/Header.tsx",
                                            lineNumber: 198,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/Header.tsx",
                                    lineNumber: 171,
                                    columnNumber: 15
                                }, this),
                                isLanguageMenuOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    onMouseEnter: ()=>setIsLanguageMenuOpen(true),
                                    onMouseLeave: ()=>setIsLanguageMenuOpen(false),
                                    style: {
                                        position: 'absolute',
                                        top: 'calc(100% + 2px)',
                                        right: '0',
                                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '4px',
                                        border: '1px solid rgba(8, 247, 254, 0.3)',
                                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                                        zIndex: 1000,
                                        minWidth: '120px',
                                        padding: '4px 0'
                                    },
                                    children: languageOptions.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: ()=>{
                                                window.location.replace(getLocalizedPath(option.code));
                                            },
                                            style: {
                                                width: '100%',
                                                backgroundColor: 'transparent',
                                                color: locale === option.code ? '#C7D0FF' : '#05f6f7',
                                                border: 'none',
                                                fontSize: 'clamp(14px, 2vw, 24px)',
                                                fontFamily: 'Roboto, sans-serif',
                                                fontWeight: locale === option.code ? 700 : 400,
                                                cursor: 'pointer',
                                                padding: '10px 16px',
                                                textAlign: 'left',
                                                outline: 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'background-color 0.3s ease, color 0.3s ease',
                                                whiteSpace: 'nowrap'
                                            },
                                            onMouseEnter: (e)=>{
                                                e.currentTarget.style.backgroundColor = 'rgba(8, 247, 254, 0.1)';
                                                e.currentTarget.style.color = '#C7D0FF';
                                            },
                                            onMouseLeave: (e)=>{
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = locale === option.code ? '#C7D0FF' : '#05f6f7';
                                            },
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    style: {
                                                        fontSize: '18px'
                                                    },
                                                    children: option.flag
                                                }, void 0, false, {
                                                    fileName: "[project]/components/Header.tsx",
                                                    lineNumber: 252,
                                                    columnNumber: 23
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    style: {
                                                        fontSize: '14px',
                                                        fontWeight: 400
                                                    },
                                                    children: option.label
                                                }, void 0, false, {
                                                    fileName: "[project]/components/Header.tsx",
                                                    lineNumber: 253,
                                                    columnNumber: 23
                                                }, this)
                                            ]
                                        }, option.code, true, {
                                            fileName: "[project]/components/Header.tsx",
                                            lineNumber: 220,
                                            columnNumber: 21
                                        }, this))
                                }, void 0, false, {
                                    fileName: "[project]/components/Header.tsx",
                                    lineNumber: 203,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/Header.tsx",
                            lineNumber: 165,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/Header.tsx",
                    lineNumber: 113,
                    columnNumber: 11
                }, this),
                isMobile && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        height: '65px',
                        flexShrink: 0
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        onClick: ()=>setIsMobileMenuOpen(!isMobileMenuOpen),
                        style: {
                            backgroundColor: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '5px',
                            outline: 'none'
                        },
                        "aria-label": "Toggle menu",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                style: {
                                    display: 'block',
                                    width: '25px',
                                    height: '3px',
                                    backgroundColor: '#05f6f7',
                                    borderRadius: '2px',
                                    transition: 'all 0.3s ease',
                                    transform: isMobileMenuOpen ? 'rotate(45deg) translate(8px, 8px)' : 'none'
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/Header.tsx",
                                lineNumber: 285,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                style: {
                                    display: 'block',
                                    width: '25px',
                                    height: '3px',
                                    backgroundColor: '#05f6f7',
                                    borderRadius: '2px',
                                    transition: 'all 0.3s ease',
                                    opacity: isMobileMenuOpen ? 0 : 1
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/Header.tsx",
                                lineNumber: 294,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                style: {
                                    display: 'block',
                                    width: '25px',
                                    height: '3px',
                                    backgroundColor: '#05f6f7',
                                    borderRadius: '2px',
                                    transition: 'all 0.3s ease',
                                    transform: isMobileMenuOpen ? 'rotate(-45deg) translate(7px, -7px)' : 'none'
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/Header.tsx",
                                lineNumber: 303,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/Header.tsx",
                        lineNumber: 271,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/Header.tsx",
                    lineNumber: 264,
                    columnNumber: 11
                }, this),
                isMobile && isMobileMenuOpen && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    style: {
                        position: 'fixed',
                        top: '65px',
                        left: 0,
                        right: 0,
                        backgroundColor: 'rgba(26, 26, 46, 0.98)',
                        backdropFilter: 'blur(10px)',
                        borderBottom: '1px solid rgba(8, 247, 254, 0.3)',
                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                        zIndex: 1000,
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    },
                    children: [
                        menuItems.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: `/${locale}${item.href}`,
                                onClick: (e)=>{
                                    e.preventDefault();
                                    setIsMobileMenuOpen(false);
                                    const element = document.querySelector(item.href);
                                    element?.scrollIntoView({
                                        behavior: 'smooth'
                                    });
                                },
                                style: {
                                    fontFamily: 'Roboto, sans-serif',
                                    fontSize: '20px',
                                    fontWeight: 700,
                                    letterSpacing: '0.8px',
                                    color: '#05f6f7',
                                    textDecoration: 'none',
                                    padding: '12px 0',
                                    borderBottom: '1px solid rgba(8, 247, 254, 0.2)',
                                    transition: 'color 0.3s ease'
                                },
                                onMouseEnter: (e)=>{
                                    e.currentTarget.style.color = '#C7D0FF';
                                },
                                onMouseLeave: (e)=>{
                                    e.currentTarget.style.color = '#05f6f7';
                                },
                                children: item.label
                            }, item.href, false, {
                                fileName: "[project]/components/Header.tsx",
                                lineNumber: 334,
                                columnNumber: 15
                            }, this)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            style: {
                                display: 'flex',
                                gap: '16px',
                                paddingTop: '12px',
                                borderTop: '1px solid rgba(8, 247, 254, 0.2)'
                            },
                            children: languageOptions.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: ()=>{
                                        window.location.replace(getLocalizedPath(option.code));
                                    },
                                    style: {
                                        backgroundColor: 'transparent',
                                        color: locale === option.code ? '#C7D0FF' : '#05f6f7',
                                        border: '1px solid rgba(8, 247, 254, 0.3)',
                                        borderRadius: '4px',
                                        fontSize: '16px',
                                        fontFamily: 'Roboto, sans-serif',
                                        fontWeight: locale === option.code ? 700 : 400,
                                        cursor: 'pointer',
                                        padding: '10px 16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.3s ease'
                                    },
                                    onMouseEnter: (e)=>{
                                        e.currentTarget.style.backgroundColor = 'rgba(8, 247, 254, 0.1)';
                                        e.currentTarget.style.color = '#C7D0FF';
                                    },
                                    onMouseLeave: (e)=>{
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = locale === option.code ? '#C7D0FF' : '#05f6f7';
                                    },
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            style: {
                                                fontSize: '20px'
                                            },
                                            children: option.flag
                                        }, void 0, false, {
                                            fileName: "[project]/components/Header.tsx",
                                            lineNumber: 400,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            children: option.label
                                        }, void 0, false, {
                                            fileName: "[project]/components/Header.tsx",
                                            lineNumber: 401,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, option.code, true, {
                                    fileName: "[project]/components/Header.tsx",
                                    lineNumber: 371,
                                    columnNumber: 17
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/components/Header.tsx",
                            lineNumber: 364,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/Header.tsx",
                    lineNumber: 318,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/Header.tsx",
            lineNumber: 75,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/Header.tsx",
        lineNumber: 66,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e75e32ce._.js.map