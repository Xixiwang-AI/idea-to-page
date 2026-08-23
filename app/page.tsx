"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GlyphProps = { size?: number; className?: string };
const glyph = (character: string) =>
  function Glyph({ size = 16, className }: GlyphProps) {
    return <span className={className} style={{ fontSize: size }} aria-hidden="true">{character}</span>;
  };

const Bold = glyph("B");
const Check = glyph("✓");
const ChevronRight = glyph("›");
const Download = glyph("↓");
const FileImage = glyph("▧");
const Heading1 = glyph("H₁");
const Heading2 = glyph("H₂");
const Highlighter = glyph("▰");
const History = glyph("◷");
const ImagePlus = glyph("▧+");
const Italic = glyph("I");
const Moon = glyph("◐");
const Palette = glyph("◉");
const PanelLeftClose = glyph("◀");
const PanelLeftOpen = glyph("☷");
const Plus = glyph("+");
const Quote = glyph("❞");
const RotateCcw = glyph("↶");
const Search = glyph("⌕");
const Settings2 = glyph("☷");
const Sparkles = glyph("✦");
const Sun = glyph("☀");
const Underline = glyph("U̲");

type Mode = "cards" | "article";
type ThemeName = "paper" | "cream" | "mist" | "night";
type AvatarShape = "square" | "dino" | "circle";
type SavedDraft = {
  content?: string;
  name?: string;
  handle?: string;
  mode?: Mode;
  avatar?: string | null;
  avatarShape?: AvatarShape;
};

const starter = `# 把今天的灵感，变成好看的内容

写作不该被排版打断。

在左边输入 Markdown，右边会实时生成适合分享的图文卡片。

## 一次创作，多处发布

一份内容，可以变成小红书图文、朋友圈长图或公众号文章。

> 好的工具应该让表达更简单，而不是增加新的工作。

## 现在就开始

调整颜色、字号与版式，然后下载你的作品。`;

const themeOptions: Array<{ id: ThemeName; label: string; color: string }> = [
  { id: "paper", label: "纯白", color: "#ffffff" },
  { id: "cream", label: "奶油", color: "#fbf4e9" },
  { id: "mist", label: "雾蓝", color: "#edf4f8" },
  { id: "night", label: "深夜", color: "#17202f" },
];

function paginate(source: string) {
  const blocks = source.trim().split(/\n\s*\n/).filter(Boolean);
  const pages: string[][] = [];
  let page: string[] = [];
  let weight = 0;
  blocks.forEach((block) => {
    const blockWeight = Math.max(1, Math.ceil(block.length / 55)) + (block.startsWith("# ") ? 2 : 0);
    if (page.length && weight + blockWeight > 8) {
      pages.push(page);
      page = [];
      weight = 0;
    }
    page.push(block);
    weight += blockWeight;
  });
  if (page.length) pages.push(page);
  return pages.length ? pages : [["# 从这里开始\n\n写下你的第一段内容。"]];
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|==[^=]+==)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith("==") && part.endsWith("==")) return <mark key={index}>{part.slice(2, -2)}</mark>;
    return part;
  });
}

function MarkdownBlocks({ blocks }: { blocks: string[] }) {
  return blocks.flatMap((block, blockIndex) =>
    block.split("\n").map((line, lineIndex) => {
      const key = `${blockIndex}-${lineIndex}`;
      if (line.startsWith("# ")) return <h3 key={key}><InlineText text={line.slice(2)} /></h3>;
      if (line.startsWith("## ")) return <h4 key={key}><InlineText text={line.slice(3)} /></h4>;
      if (line.startsWith("> ")) return <blockquote key={key}><InlineText text={line.slice(2)} /></blockquote>;
      if (/^[-*] /.test(line)) return <p className="bullet" key={key}><span>•</span><InlineText text={line.slice(2)} /></p>;
      return <p key={key}><InlineText text={line} /></p>;
    }),
  );
}

export default function Home() {
  const [content, setContent] = useState(starter);
  const [mode, setMode] = useState<Mode>("cards");
  const [dark, setDark] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [name, setName] = useState("灵感笔记");
  const [handle, setHandle] = useState("@ideatopage");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarShape, setAvatarShape] = useState<AvatarShape>("circle");
  const [accent, setAccent] = useState("#2563eb");
  const [theme, setTheme] = useState<ThemeName>("paper");
  const [fontSize, setFontSize] = useState(17);
  const [lineHeight, setLineHeight] = useState(1.75);
  const [toast, setToast] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const pages = useMemo(() => paginate(content), [content]);
  const visiblePages = mode === "article" ? [pages.flat()] : pages;
  const activeTheme = themeOptions.find((option) => option.id === theme)!;
  const cardInk = theme === "night" ? "#f7f8fb" : "#1a2433";
  const avatarLetter = name.trim().slice(0, 1) || "灵";

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("idea-to-page-draft") ?? "{}") as SavedDraft;
      if (saved.content) setContent(saved.content);
      if (saved.name) setName(saved.name);
      if (saved.handle) setHandle(saved.handle);
      if (saved.mode === "cards" || saved.mode === "article") setMode(saved.mode);
      if (saved.avatar) setAvatar(saved.avatar);
      if (saved.avatarShape === "square" || saved.avatarShape === "dino" || saved.avatarShape === "circle") {
        setAvatarShape(saved.avatarShape);
      }
    } catch {
      // A damaged local draft should never prevent opening the editor.
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem("idea-to-page-draft", JSON.stringify({ content, name, handle, mode, avatar, avatarShape }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [avatar, avatarShape, content, draftReady, handle, mode, name]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const wrapSelection = (before: string, after = before) => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = content.slice(start, end) || "文字";
    const next = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(next);
    window.requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const prefixLine = (prefix: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = content.lastIndexOf("\n", editor.selectionStart - 1) + 1;
    setContent(content.slice(0, start) + prefix + content.slice(start));
    window.requestAnimationFrame(() => editor.focus());
  };

  const changeAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("请选择图片文件");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      notify("头像请控制在 12MB 以内");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => notify("头像读取失败，请换一张图片试试");
    reader.onload = () => {
      const source = String(reader.result);
      const image = new Image();
      image.onerror = () => notify("头像处理失败，请换一张图片试试");
      image.onload = () => {
        const limit = 720;
        const scale = Math.min(1, limit / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          notify("头像处理失败，请换一张图片试试");
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setAvatar(canvas.toDataURL("image/jpeg", 0.9));
        notify("头像已更新");
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatar(null);
    notify("已恢复默认头像");
  };

  const chooseAvatarShape = (shape: AvatarShape) => {
    setAvatarShape(shape);
    notify(`已切换为${shape === "square" ? "方形" : shape === "dino" ? "小恐龙" : "圆形"}头像`);
  };

  const download = async () => {
    const cards = Array.from(cardContainerRef.current?.querySelectorAll<HTMLElement>(".share-card") ?? []);
    if (!cards.length) return;
    notify("正在生成高清图片…");
    const { toPng } = await import("html-to-image");
    for (let index = 0; index < cards.length; index += 1) {
      const dataUrl = await toPng(cards[index], { pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.download = `灵感成页-${String(index + 1).padStart(2, "0")}.png`;
      link.href = dataUrl;
      link.click();
    }
    notify(cards.length > 1 ? `已生成 ${cards.length} 张图片` : "图片已下载");
  };

  const resetProject = () => {
    if (content !== starter) localStorage.setItem("idea-to-page-previous", content);
    setContent("# 新的灵感\n\n从这里开始写作。");
    notify("已新建空白作品");
  };

  const restorePrevious = () => {
    const previous = localStorage.getItem("idea-to-page-previous");
    if (previous) {
      setContent(previous);
      notify("已恢复上一份作品");
    }
  };

  return (
    <main className={dark ? "app dark" : "app"}>
      <aside className={historyOpen ? "history-sidebar open" : "history-sidebar"} aria-label="历史记录">
        {!historyOpen && (
          <button className="history-tab" aria-label="打开历史记录" onClick={() => setHistoryOpen(true)}>
            <PanelLeftOpen size={18} />
          </button>
        )}
        <div className="history-drawer">
          <div className="history-head">
            <span><History size={16} />历史记录</span>
            <button className="mini-icon" aria-label="收起历史记录" onClick={() => setHistoryOpen(false)}><PanelLeftClose size={17} /></button>
          </div>
          <p>自动保存在当前设备</p>
          <div className="history-filters"><button className="active">全部</button><button>图文</button><button>长文</button></div>
          <button className="history-card current">
            <span className="history-type">当前作品</span>
            <strong>{content.match(/^# (.+)$/m)?.[1] ?? "未命名作品"}</strong>
            <small>刚刚自动保存 · {pages.length} 页</small>
          </button>
          <button className="history-card" onClick={restorePrevious}>
            <span className="history-type">上一份</span>
            <strong>最近编辑的内容</strong>
            <small>点击恢复</small>
          </button>
        </div>
      </aside>

      <section className="editor-panel">
        <header className="brand-row">
          <div className="brand-title">
            <h1>灵感成页</h1>
            <p className="brand-en">IDEA TO PAGE</p>
            <span className="subtle">{mode === "cards" ? `${pages.length} 张图片` : "1 篇长文"}</span>
          </div>
          <div className="segmented" aria-label="内容模式">
            <button className={mode === "cards" ? "active" : ""} onClick={() => setMode("cards")}>图文卡片</button>
            <button className={mode === "article" ? "active" : ""} onClick={() => setMode("article")}>长文</button>
          </div>
          <div className="brand-actions">
            <button className="square" aria-label="新建作品" title="新建作品" onClick={resetProject}><Plus size={18} /></button>
            <button className="square" aria-label="切换主题" title="切换界面主题" onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          </div>
        </header>

        <section className="editor-controls">
          {mode === "cards" && (
            <>
            <div className="profile-row">
              <button
                className={`avatar avatar-upload avatar-${avatarShape}`}
                type="button"
                aria-label="更换头像"
                title="点击更换头像"
                onClick={() => avatarInputRef.current?.click()}
              >
                {avatar ? <img src={avatar} alt="" /> : avatarLetter}
                <span className="avatar-edit-badge">更换</span>
              </button>
              <input
                ref={avatarInputRef}
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={changeAvatar}
              />
              <input aria-label="名称" value={name} onChange={(event) => setName(event.target.value)} />
              <input aria-label="账号" value={handle} onChange={(event) => setHandle(event.target.value)} />
              <button
                className="tool-button"
                type="button"
                aria-label={avatar ? "恢复默认头像" : "选择头像"}
                title={avatar ? "恢复默认头像" : "选择头像"}
                onClick={avatar ? removeAvatar : () => avatarInputRef.current?.click()}
              >
                {avatar ? <RotateCcw size={16} /> : <ImagePlus size={16} />}
              </button>
            </div>
            <div className="avatar-shape-picker" role="group" aria-label="头像形状">
              <span className="avatar-shape-label">头像形状</span>
              {([
                ["square", "方形"],
                ["dino", "小恐龙"],
                ["circle", "圆形"],
              ] as Array<[AvatarShape, string]>).map(([shape, label]) => (
                <button
                  key={shape}
                  className={avatarShape === shape ? "avatar-shape-option selected" : "avatar-shape-option"}
                  type="button"
                  aria-pressed={avatarShape === shape}
                  onClick={() => chooseAvatarShape(shape)}
                >
                  <span className={`avatar-shape-sample avatar-${shape}`} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            </>
          )}

          <div className="toolbar" aria-label="文字样式">
            <button className="tool-button" title="一级标题" onClick={() => prefixLine("# ")}><Heading1 /></button>
            <button className="tool-button" title="二级标题" onClick={() => prefixLine("## ")}><Heading2 /></button>
            <button className="tool-button" title="加粗" onClick={() => wrapSelection("**")}><Bold /></button>
            <button className="tool-button" title="斜体" onClick={() => wrapSelection("*")}><Italic /></button>
            <button className="tool-button" title="下划线" onClick={() => wrapSelection("<u>", "</u>")}><Underline /></button>
            <button className="tool-button" title="重点引用" onClick={() => prefixLine("> ")}><Quote /></button>
            <button className="tool-button" title="高亮" onClick={() => wrapSelection("==")}><Highlighter /></button>
            <button className="tool-button" title="插入图片" onClick={() => notify("图片插入将在下一版本开放")}><ImagePlus /></button>
            <button className="tool-button" title="查找" onClick={() => { editorRef.current?.focus(); notify("可使用 ⌘F 在编辑器内查找"); }}><Search /></button>
            <button className={settingsOpen ? "tool-button active" : "tool-button"} title="设计设置" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 /></button>
          </div>

          {settingsOpen && (
            <div className="settings-panel">
              <div className="settings-title"><span><Palette size={16} />卡片设计</span><small>实时生效</small></div>
              <label>强调色<input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} /></label>
              <label>字号<input type="range" min="14" max="22" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /><b>{fontSize}</b></label>
              <label>行距<input type="range" min="1.4" max="2.1" step=".05" value={lineHeight} onChange={(event) => setLineHeight(Number(event.target.value))} /><b>{lineHeight}</b></label>
              <div className="theme-swatches">
                {themeOptions.map((option) => (
                  <button key={option.id} className={theme === option.id ? "selected" : ""} onClick={() => setTheme(option.id)} title={option.label}>
                    <span style={{ background: option.color }} />{theme === option.id && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <div className="editor-wrap">
          <textarea
            ref={editorRef}
            className="editor"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            aria-label="Markdown 编辑器"
          />
          <div className="editor-status"><span><Check size={12} />已自动保存</span><span>{content.replace(/\s/g, "").length} 字</span></div>
        </div>
      </section>

      <section className="preview-panel">
        <header className="preview-topbar">
          <div>
            <h2>预览与下载</h2>
            <span className="subtle">{mode === "cards" ? "自动分页已开启" : "公众号长文样式"}</span>
          </div>
          <div className="topbar-actions">
            <button className="secondary" onClick={() => { setContent(starter); notify("示例内容已恢复"); }}><RotateCcw size={16} />恢复示例</button>
            <button className="primary" onClick={download}><Download size={17} />{mode === "cards" && pages.length > 1 ? "批量下载" : "下载图片"}</button>
          </div>
        </header>

        <div className={mode === "article" ? "preview-stage article-stage" : "preview-stage"} ref={cardContainerRef}>
          <div className="pages">
            {visiblePages.map((page, index) => (
              <article
                className={mode === "article" ? "share-card article-card" : "share-card"}
                key={index}
                style={{ "--card-bg": activeTheme.color, "--card-ink": cardInk, "--card-accent": accent, "--copy-size": `${fontSize}px`, "--copy-leading": lineHeight } as React.CSSProperties}
              >
                <div className="card-profile">
                  <div className={`avatar avatar-${avatarShape}`}>{avatar ? <img src={avatar} alt="" /> : avatarLetter}</div>
                  <div><strong>{name || "未命名"}</strong><span>{handle || "@yourname"}</span></div>
                  <Sparkles className="profile-mark" size={17} />
                </div>
                <div className="card-copy"><MarkdownBlocks blocks={page} /></div>
                <footer><span>IDEA TO PAGE</span><span>{String(index + 1).padStart(2, "0")} / {String(visiblePages.length).padStart(2, "0")}</span></footer>
              </article>
            ))}
          </div>
          {mode === "cards" && (
            <aside className="preview-note">
              <FileImage size={18} />
              <div><strong>高清 PNG</strong><span>1080 × 1440 比例</span></div>
              <ChevronRight size={16} />
            </aside>
          )}
        </div>
      </section>

      <div className={toast ? "toast show" : "toast"} aria-live="polite"><Check size={15} />{toast}</div>
    </main>
  );
}
