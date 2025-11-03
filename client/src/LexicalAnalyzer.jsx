import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
const LANGUAGE_KEYWORDS = {
    c: new Set([
        "auto", "break", "case", "char", "const", "continue", "default", "do",
        "double", "else", "enum", "extern", "float", "for", "goto", "if",
        "int", "long", "register", "return", "short", "signed", "sizeof", "static",
        "struct", "switch", "typedef", "union", "unsigned", "void", "volatile", "while"
    ]),
    java: new Set([
        "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char",
        "class", "const", "continue", "default", "do", "double", "else", "enum",
        "extends", "final", "finally", "float", "for", "goto", "if", "implements",
        "import", "instanceof", "int", "interface", "long", "native", "new", "package",
        "private", "protected", "public", "return", "short", "static", "strictfp", "super",
        "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void",
        "volatile", "while"
    ]),
    python: new Set([
        "False", "None", "True", "and", "as", "assert", "async", "await", "break",
        "class", "continue", "def", "del", "elif", "else", "except", "finally",
        "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal",
        "not", "or", "pass", "raise", "return", "try", "while", "with", "yield"
    ]),
    javascript: new Set([
        "if", "else", "for", "while", "return", "function", "const", "let", "var",
        "import", "from", "export", "class", "extends", "new", "try", "catch", "finally",
        "switch", "case", "break", "continue", "default", "throw", "await", "async"
    ])
};
const LANGUAGE_EXAMPLES = {
    c: `// C example
#include <stdio.h>

int main() {
    int x = 10;
    printf("Hello, World! %d\\n", x);
    return 0;
}`,
    java: `// Java example
public class HelloWorld {
    public static void main(String[] args) {
        int x = 10;
        System.out.println("Hello, World! " + x);
    }
}`,
    python: `# Python example
def hello(name):
    x = 10
    print(f"Hello, {name}! {x}")
    
hello("World")`,
    javascript: `// JavaScript example
function hello(name) {
    const x = 10;
    console.log("Hello, " + name + "! " + x);
}
hello("World");`
};

function lexicalAnalyze(input, language) {
    const tokens = [];
    let i = 0;
    let line = 1;
    let col = 1;
    const keywords = LANGUAGE_KEYWORDS[language] || LANGUAGE_KEYWORDS.javascript;

    const advance = (n = 1) => {
        for (let k = 0; k < n; k++) {
            if (input[i] === "\n") {
                line++;
                col = 1;
            } else {
                col++;
            }
            i++;
        }
    };

    const peek = (offset = 0) => input[i + offset] || "";

    while (i < input.length) {
        const ch = peek();

        if (/\s/.test(ch)) {
            advance();
            continue;
        }

        const startLine = line;
        const startCol = col;

        // Python comments (#)
        if (language === "python" && ch === "#") {
            let s = "#";
            advance();
            while (i < input.length && peek() !== "\n") {
                s += peek();
                advance();
            }
            tokens.push({ type: "comment_line", value: s, line: startLine, col: startCol });
            continue;
        }

        // Preprocessor directives (C/C++)
        if (language === "c" && ch === "#") {
            let s = "#";
            advance();
            while (i < input.length && peek() !== "\n") {
                s += peek();
                advance();
            }
            tokens.push({ type: "preprocessor", value: s, line: startLine, col: startCol });
            continue;
        }
        if (/[A-Za-z_]/.test(ch) || (language === "python" && ch === "@")) {
            let s = ch;
            advance();
            while (/[A-Za-z0-9_]/.test(peek())) {
                s += peek();
                advance();
            }
            tokens.push({
                type: keywords.has(s) ? "keyword" : "identifier",
                value: s,
                line: startLine,
                col: startCol,
            });
            continue;
        }
        if (/\d/.test(ch)) {
            let s = ch;
            advance();
            while (/\d/.test(peek())) {
                s += peek();
                advance();
            }
            if (peek() === "." && /\d/.test(peek(1))) {
                s += ".";
                advance();
                while (/\d/.test(peek())) {
                    s += peek();
                    advance();
                }
            }
            // Handle scientific notation
            if ((peek() === "e" || peek() === "E") && (/\d/.test(peek(1)) || peek(1) === "-" || peek(1) === "+")) {
                s += peek();
                advance();
                if (peek() === "-" || peek() === "+") {
                    s += peek();
                    advance();
                }
                while (/\d/.test(peek())) {
                    s += peek();
                    advance();
                }
            }
            tokens.push({ type: "number", value: s, line: startLine, col: startCol });
            continue;
        }
        if (ch === '"' || ch === "'" || (language === "javascript" && ch === "`")) {
            const quote = ch;
            let s = ch;
            advance();
            let escaped = false;
            while (i < input.length) {
                const c = peek();
                s += c;
                advance();
                if (!escaped && c === quote) break;
                if (c === "\\" && !escaped) escaped = true;
                else escaped = false;
            }
            tokens.push({ type: "string", value: s, line: startLine, col: startCol });
            continue;
        }
        if ((language === "c" || language === "java" || language === "javascript") && ch === "/" && peek(1) === "/") {
            let s = "//";
            advance(2);
            while (i < input.length && peek() !== "\n") {
                s += peek();
                advance();
            }
            tokens.push({ type: "comment_line", value: s, line: startLine, col: startCol });
            continue;
        }
        
        if ((language === "c" || language === "java" || language === "javascript") && ch === "/" && peek(1) === "*") {
            let s = "/*";
            advance(2);
            while (i < input.length && !(peek() === "*" && peek(1) === "/")) {
                s += peek();
                advance();
            }
            if (peek() === "*" && peek(1) === "/") {
                s += "*/";
                advance(2);
            }
            tokens.push({ type: "comment_block", value: s, line: startLine, col: startCol });
            continue;
        }
        const two = ch + peek(1);
        const three = two + peek(2);
        const multiOps = new Set([
            "===", "!==", "==", "!=", "<=", ">=", "&&", "||", "=>", 
            "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=",
            "<<", ">>", "->", "::"
        ]);
        
        if (three && multiOps.has(three)) {
            tokens.push({ type: "operator", value: three, line: startLine, col: startCol });
            advance(3);
            continue;
        }
        if (two && multiOps.has(two)) {
            tokens.push({ type: "operator", value: two, line: startLine, col: startCol });
            advance(2);
            continue;
        }
        const singleOps = new Set(["+", "-", "*", "/", "%", "=", "<", ">", "!", "&", "|", "^", "~", "?", ":", ".", ",", ";"]);
        const punctuation = new Set(["(", ")", "{", "}", "[", "]"]);
        
        if (singleOps.has(ch)) {
            tokens.push({ type: "operator", value: ch, line: startLine, col: startCol });
            advance();
            continue;
        }
        if (punctuation.has(ch)) {
            tokens.push({ type: "punctuation", value: ch, line: startLine, col: startCol });
            advance();
            continue;
        }
        tokens.push({ type: "unknown", value: ch, line: startLine, col: startCol });
        advance();
    }
    return tokens;
}
function detectIssues(src, tokens, language) {
    const issues = [];
    tokens.forEach(t => {
        if (t.type === "string") {
            const first = t.value[0];
            const last = t.value[t.value.length - 1];
            if ((first === `"` || first === `'` || first === "`") && first !== last) {
                issues.push(`Unclosed string starting at line ${t.line}, column ${t.col}`);
            }
        }
        if (t.type === "comment_block" && !t.value.endsWith("*/")) {
            issues.push(`Unterminated block comment at line ${t.line}, column ${t.col}`);
        }
    });
    if (language !== "python") {
        const pairs = { "{": "}", "(": ")", "[": "]" };
        Object.keys(pairs).forEach(open => {
            const close = pairs[open];
            const countOpen = (src.match(new RegExp(`\\${open}`, "g")) || []).length;
            const countClose = (src.match(new RegExp(`\\${close}`, "g")) || []).length;
            if (countOpen > countClose) {
                issues.push(`Missing ${countOpen - countClose} closing '${close}'`);
            } else if (countClose > countOpen) {
                issues.push(`Extra ${countClose - countOpen} closing '${close}'`);
            }
        });
    }
    if (language === "c" || language === "java") {
        const lines = src.split("\n");
        lines.forEach((ln, idx) => {
            const trimmed = ln.trim();
            if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("#")) return;
            if (!trimmed.endsWith(";") && !trimmed.endsWith("{") && !trimmed.endsWith("}") && 
                !/^(if|else|for|while|do|switch|case|default|public|private|protected|class|import|package)/.test(trimmed)) {
                if (trimmed.length > 0 && !/[\{\}]/.test(trimmed)) {
                    issues.push(`Line ${idx + 1}: possibly missing semicolon`);
                }
            }
        });
    }
    if (language === "python") {
        const lines = src.split("\n");
        lines.forEach((ln, idx) => {
            if (ln.trim() && /^\s+/.test(ln)) {
                const spaces = ln.match(/^\s+/)[0].length;
                if (spaces % 4 !== 0 && spaces % 2 !== 0) {
                    issues.push(`Line ${idx + 1}: inconsistent indentation`);
                }
            }
        });
    }
    return issues;
}
function buildCorrection(src, language) {
    let lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const single = (line.match(/'/g) || []).length;
        const dbl = (line.match(/"/g) || []).length;
        if (single % 2 === 1 && dbl % 2 === 0) lines[i] = line + "'";
        else if (dbl % 2 === 1 && single % 2 === 0) lines[i] = line + '"';
    }
    if (language === "c" || language === "java") {
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("#")) continue;
            if (!trimmed.endsWith(";") && !trimmed.endsWith("{") && !trimmed.endsWith("}") && 
                !/^(if|else|for|while|do|switch|case|default|public|private|protected|class|import|package)/.test(trimmed)) {
                if (trimmed.length > 0 && !/[\{\}]/.test(trimmed)) {
                    lines[i] = lines[i].replace(/\s+$/g, "") + ";";
                }
            }
        }
    }
    if (language !== "python") {
        const closers = { "{": "}", "(": ")", "[": "]" };
        Object.keys(closers).forEach(op => {
            const cl = closers[op];
            const cOpen = (src.match(new RegExp(`\\${op}`, "g")) || []).length;
            const cClose = (src.match(new RegExp(`\\${cl}`, "g")) || []).length;
            if (cOpen > cClose) {
                for (let k = 0; k < cOpen - cClose; k++) lines.push(cl);
            }
        });
    }
    return lines.join("\n");
}
export default function CompilerAnalyzer() {
    const [language, setLanguage] = useState("c");
    const [code, setCode] = useState(LANGUAGE_EXAMPLES.c);
    const [tokens, setTokens] = useState([]);
    const [analysis, setAnalysis] = useState("");
    const [corrected, setCorrected] = useState("");
    const [aiAnalysis, setAiAnalysis] = useState("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const handleLanguageChange = (newLang) => {
        setLanguage(newLang);
        setCode(LANGUAGE_EXAMPLES[newLang]);
        setTokens([]);
        setAnalysis("");
        setCorrected("");
        setAiAnalysis("");
    };
    const analyzeWithAI = async (sourceCode, lang) => {
        setIsAnalyzing(true);
        try {
             const response = await fetch(`https://lexical-analyzer-hw4z.onrender.com/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: sourceCode,
          language: lang,
        }),
      });
            const data = await response.json();
            setAiAnalysis(data.analysis);
            if (data.corrections) {
                setCorrected(data.corrections);
            }
        } catch (error) {
            setAiAnalysis("Error analyzing code with AI: " + error.message);
        } finally {
            setIsAnalyzing(false);
        }
    };
    const handleAnalyze = async () => {
        const lex = lexicalAnalyze(code, language);
        setTokens(lex);
        
        const issues = detectIssues(code, lex, language);
        const correctedCode = buildCorrection(code, language);
        
        const analysisText = issues.length === 0
            ? `✅ No lexical issues detected in your ${language.toUpperCase()} code.\n\nTokens were analyzed successfully. The code appears to be syntactically correct at the lexical level.`
            : `⚠️ Detected lexical issues in your ${language.toUpperCase()} code:\n\n` + issues.map(i => `• ${i}`).join("\n");
        setAnalysis(analysisText);
        setCorrected(correctedCode);
        await analyzeWithAI(code, language);
    };
    const applyFixes = () => {
        if (corrected) setCode(corrected);
    };
    return (
        <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, sans-serif", maxWidth: 1400, margin: "0 auto" }}>
            <h1 style={{ marginBottom: 8, color: "#fcfbfbff" }}>Lexical Analyzer</h1>
            <p style={{ color: "#979797ff", marginBottom: 24 }}>Multi-language syntax analysis through lexical tokenization</p>

            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                {Object.keys(LANGUAGE_EXAMPLES).map(lang => (
                    <button
                        key={lang}
                        onClick={() => handleLanguageChange(lang)}
                        style={{
                            padding: "10px 20px",
                            background: language === lang ? "#2563eb" : "#e5e7eb",
                            color: language === lang ? "white" : "#000000ff",
                            border: "none",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontWeight: language === lang ? "600" : "normal",
                            textTransform: "uppercase",
                            fontSize: 13,
                            letterSpacing: "0.5px"
                        }}
                    >
                        {lang}
                    </button>
                ))}
            </div>

            <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 500, color: "#a5b1e7ff" }}>
                    Source Code ({language.toUpperCase()})
                </label>
                <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    rows={14}
                    style={{ 
                        width: "100%", 
                        padding: 12, 
                        border: "1px solid #d1d5db", 
                        borderRadius: 6, 
                        fontFamily: "Consolas, Monaco, 'Courier New', monospace", 
                        fontSize: 13,
                        lineHeight: 1.5,
                        resize: "vertical"
                    }}
                />
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    style={{ 
                        padding: "10px 24px", 
                        background: isAnalyzing ? "#9ca3af" : "#2563eb", 
                        color: "white", 
                        border: "none", 
                        borderRadius: 6, 
                        cursor: isAnalyzing ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        fontSize: 14
                    }}
                >
                    {isAnalyzing ? "Analyzing..." : "🔍 Analyze Code"}
                </button>
                <button 
                    onClick={() => { 
                        setTokens([]); 
                        setAnalysis(""); 
                        setCorrected(""); 
                        setAiAnalysis("");
                    }}
                    style={{ 
                        padding: "10px 24px", 
                        background: "#20355fff", 
                        color: "#a7bddfff", 
                        border: "none", 
                        borderRadius: 6, 
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 14
                    }}
                >
                    🔄 Reset
                </button>
               
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: 16, fontWeight: 600, color: "#91a7e2ff" }}>
                        Tokens ({tokens.length})
                    </h3>
                    <div style={{ 
                        maxHeight: 400, 
                        overflow: "auto", 
                        background: "#01021dff", 
                        border: "1px solid #e5e7eb", 
                        padding: 12, 
                        borderRadius: 6 
                    }}>
                        {tokens.length === 0 ? (
                            <div style={{ color: "#adadadff", fontSize: 14 }}>No tokens yet — click Analyze to start.</div>
                        ) : (
                            <div style={{ fontSize: 13, fontFamily: "monospace" }}>
                                {tokens.map((t, idx) => (
                                    <div key={idx} style={{ padding: "4px 0", borderBottom: idx < tokens.length - 1 ? "1px solid #e5e7eb" : "none" }}>
                                        <span style={{ 
                                            display: "inline-block", 
                                            padding: "2px 6px", 
                                            background: 
                                                t.type === "keyword" ? "#1a4a88ff" : 
                                                t.type === "string" ? "#b8a147ff" : 
                                                t.type === "number" ? "#3f7458ff" : 
                                                t.type === "comment_line" || t.type === "comment_block" ? "#345fb4ff" :
                                                t.type === "operator" ? "#776856ff" :
                                                t.type === "preprocessor" ? "#5c3388ff" :
                                                "#45639eff",
                                            borderRadius: 4,
                                            marginRight: 8,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: "#e0e3e7ff"
                                        }}>
                                            {t.type}
                                        </span>
                                        <span style={{ color: "#d1d0d0ff" }}>"{t.value.replace(/\n/g, "\\n")}"</span>
                                        <span style={{ color: "#616161ff", marginLeft: 8 }}>({t.line}:{t.col})</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                   <h3
  style={{
    margin: "0 0 12px 0",
    fontSize: 16,
    fontWeight: 600,
    color: "#91a7e2ff",
  }}
>
  Analysis Report {isAnalyzing && "🤔"}
</h3>

<div
  style={{
    whiteSpace: "pre-wrap",
    background: "#01021dff",
    border: "1px solid #c5cee0ff",
    padding: 12,
    borderRadius: 6,
    minHeight: 180,
    maxHeight: 400,
    overflow: "auto",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#b6bdc9ff",
  }}
>
  {isAnalyzing ? (
    "AI is analyzing your code..."
  ) : analysis || aiAnalysis ? (
    <>
      {analysis && <p>{analysis}</p>}

      {aiAnalysis && (
        <>
          <strong style={{ color: "#c9d1d9" }}>AI Analysis:</strong>
          <div style={{ marginTop: 8 }}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        background: "#0b0f2c",
                        borderRadius: "6px",
                        fontSize: "13px",
                        padding: "10px",
                      }}
                      {...props}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code
                      style={{
                        backgroundColor: "#202540",
                        padding: "2px 5px",
                        borderRadius: "4px",
                        color: "#d1e8ff",
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                h3({ children }) {
                  return (
                    <h3 style={{ color: "#91a7e2ff", fontSize: 15, marginTop: 12 }}>
                      {children}
                    </h3>
                  );
                },
                strong({ children }) {
                  return (
                    <strong style={{ color: "#e2e6f0", fontWeight: 600 }}>
                      {children}
                    </strong>
                  );
                },
                li({ children }) {
                  return (
                    <li style={{ marginBottom: "4px", listStyleType: "disc", marginLeft: "16px" }}>
                      {children}
                    </li>
                  );
                },
              }}
            >
              {aiAnalysis}
            </ReactMarkdown>
          </div>
        </>
      )}
    </>
  ) : (
    <span style={{ color: "#9ca3af" }}>
      Analysis results will appear here after you click Analyze.
    </span>
  )}
</div>
                </div>
            </div>
        </div>
    );
}
