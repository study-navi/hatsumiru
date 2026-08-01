(() => {
  const DB_NAME = "juku-print-library";
  const STORE = "materials";
  const ENDPOINT = location.hostname.endsWith("github.io")
    ? "https://printstock-shared.baystars1899.chatgpt.site/api/shared-workspace"
    : "/api/shared-workspace";

  const css = `
    .ps-share-section{margin-top:18px}.ps-share-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.ps-share-actions button{min-height:42px;padding:0 16px;border-radius:10px;border:1px solid #4f46e5;background:#4f46e5;color:#fff;font-weight:700;cursor:pointer}.ps-share-actions button:last-child{background:#fff;color:#4f46e5}
    .ps-share-cover{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.56);display:grid;place-items:center;padding:20px}.ps-share-modal{width:min(760px,100%);max-height:min(780px,calc(100vh - 40px));overflow:auto;background:#fff;border-radius:20px;padding:26px;box-shadow:0 30px 80px rgba(15,23,42,.36);color:#1e293b}.ps-share-modal h2{margin:0 0 6px;font-size:24px}.ps-share-modal p{color:#64748b;line-height:1.6}.ps-share-close{float:right;border:0;background:#f1f5f9;border-radius:10px;width:38px;height:38px;font-size:20px;cursor:pointer}.ps-share-row{display:flex;gap:10px;align-items:center;margin:14px 0}.ps-share-row input,.ps-share-row select{min-height:44px;border:1px solid #cbd5e1;border-radius:10px;padding:0 12px;font-size:16px;flex:1;min-width:0}.ps-share-primary{min-height:44px;padding:0 18px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-weight:700;cursor:pointer}.ps-share-note{margin:14px 0;padding:13px;background:#eef2ff;border-radius:12px;color:#3730a3}.ps-share-card{border:1px solid #dbeafe;border-radius:14px;padding:16px;margin-top:14px}.ps-share-card b{font-size:17px}.ps-share-code{font-size:28px;letter-spacing:.08em;font-weight:800;color:#312e81;margin:10px 0}.ps-share-meta{font-size:13px;color:#64748b;margin-top:7px}.ps-share-warning{padding:12px;border-radius:10px;background:#fffbeb;color:#92400e;margin:12px 0}.ps-share-apply{margin-top:12px}.ps-share-empty{padding:22px;text-align:center;color:#64748b}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);

  const norm = value => String(value || "").replace(/\s+/gu, " ").trim().toLocaleLowerCase("ja");
  const now = () => new Date().toISOString();
  const endpoint = ENDPOINT;

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function getMaterials() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  }
  async function putMaterial(material) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(material);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    });
  }
  function clean(value, key = "") {
    if (key === "file" || key === "answerFile" || key === "previewUrl") return undefined;
    if (value instanceof Blob || value instanceof ArrayBuffer) return undefined;
    if (Array.isArray(value)) return value.map(item => clean(item)).filter(item => item !== undefined);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).flatMap(([k, v]) => {
        const cleaned = clean(v, k);
        return cleaned === undefined ? [] : [[k, cleaned]];
      }));
    }
    return value;
  }
  function fingerprint(material) {
    return {
      title: norm(material.title),
      grade: norm(material.grade),
      subject: norm(material.subject),
      bytes: material.file?.size || material.fileSize || 0,
      answerBytes: material.answerFile?.size || material.answerFileSize || 0,
      questionUnits: (material.segments || []).length,
      answerUnits: (material.answerSegments || []).length
    };
  }
  function code() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    return "PS-" + [...bytes].map(b => chars[b % chars.length]).join("").replace(/(.{4})/g, "$1-").replace(/-$/, "");
  }
  function close() { document.querySelector(".ps-share-cover")?.remove(); }
  function modal(content) {
    close();
    const cover = document.createElement("div");
    cover.className = "ps-share-cover";
    cover.innerHTML = `<div class="ps-share-modal"><button class="ps-share-close" aria-label="閉じる">×</button><div class="ps-share-body"></div></div>`;
    cover.querySelector(".ps-share-body").append(content);
    cover.querySelector(".ps-share-close").onclick = close;
    cover.addEventListener("mousedown", event => { if (event.target === cover) close(); });
    document.body.append(cover);
    return cover;
  }
  function el(html) {
    const node = document.createElement("div");
    node.innerHTML = html.trim();
    return node.firstElementChild;
  }
  function shareDialog() {
    const content = el(`<div><h2>栞を送る</h2><p>PDF本体は送らず、単元分け・目次・解答対応だけを共有します。</p><div class="ps-share-row"><select aria-label="送る教材"></select><button class="ps-share-primary">共有コードを作成</button></div><div class="ps-share-note">受け取る側には、同じ教材PDFが必要です。コードは必要な先生だけに渡してください。</div></div>`);
    const select = content.querySelector("select");
    getMaterials().then(materials => {
      if (!materials.length) { select.replaceWith(el(`<div class="ps-share-empty">送れる教材がありません。</div>`)); content.querySelector("button").disabled = true; return; }
      materials.forEach((material, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `\${material.title || "名称未設定"} ・ \${material.grade || "学年未設定"} ・ \${(material.segments || []).length}単元`;
        select.append(option);
      });
      content.querySelector("button").onclick = async event => {
        const button = event.currentTarget;
        const material = materials[Number(select.value)];
        const shareCode = code();
        const payload = {
          type: "printstock-bookmark-pack",
          version: 1,
          code: shareCode,
          createdAt: now(),
          material: clean(material),
          fingerprint: fingerprint(material)
        };
        button.disabled = true; button.textContent = "送信中…";
        try {
          const response = await fetch(endpoint, {
            method: "PUT",
            headers: { "content-type": "application/json", "x-printstock-workspace": shareCode },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "送信できませんでした");
          content.innerHTML = `<h2>栞を送る</h2><p>次のコードを受け取る先生へ伝えてください。</p><div class="ps-share-card"><b>\${material.title || "名称未設定"}</b><div class="ps-share-code">\${shareCode}</div><div class="ps-share-meta">問題 \${(material.segments || []).length}単元・解答 \${(material.answerSegments || []).length}単元 ／ \${new Date(payload.createdAt).toLocaleString("ja-JP")}</div></div><div class="ps-share-warning">このコードで受け取れるのは栞・単元情報のみです。PDF自体は送信されません。</div>`;
          navigator.clipboard?.writeText(shareCode).catch(() => {});
        } catch (error) {
          button.disabled = false; button.textContent = "共有コードを作成";
          alert(error.message || "送信できませんでした");
        }
      };
    });
    modal(content);
  }
  function receiveDialog() {
    const content = el(`<div><h2>栞を受け取る</h2><p>受け取った共有コードを入力してください。PDFはこの端末の教材にだけ適用します。</p><div class="ps-share-row"><input aria-label="共有コード" placeholder="例：PS-ABCD-EFGH-IJKL" autocomplete="off"><button class="ps-share-primary">コードを確認</button></div></div>`);
    const input = content.querySelector("input");
    content.querySelector("button").onclick = async event => {
      const shareCode = input.value.trim().toUpperCase();
      if (shareCode.length < 8) return alert("共有コードを入力してください。");
      const button = event.currentTarget; button.disabled = true; button.textContent = "確認中…";
      try {
        const response = await fetch(endpoint, { headers: { "x-printstock-workspace": shareCode } });
        if (!response.ok) throw new Error("コードが見つからないか、無効になっています。");
        const pack = await response.json();
        if (pack?.type !== "printstock-bookmark-pack" || !pack.material) throw new Error("このコードは共有栞ではありません。");
        const materials = await getMaterials();
        const source = pack.fingerprint || {};
        const exact = materials.filter(item => {
          const fp = fingerprint(item);
          return fp.title === source.title && fp.grade === source.grade && fp.subject === source.subject && !!fp.bytes && fp.bytes === source.bytes;
        });
        const similar = materials.filter(item => !exact.includes(item) && norm(item.title) === source.title && norm(item.grade) === source.grade && norm(item.subject) === source.subject);
        const choices = [...exact, ...similar];
        const panel = el(`<div><h2>受け取る栞を確認</h2><div class="ps-share-card"><b>\${pack.material.title || "名称未設定"}</b><div class="ps-share-meta">問題 \${(pack.material.segments || []).length}単元・解答 \${(pack.material.answerSegments || []).length}単元<br>最終共有：\${new Date(pack.createdAt).toLocaleString("ja-JP")}</div></div></div>`);
        if (!choices.length) {
          panel.append(el(`<div class="ps-share-warning">この端末に一致する教材がありません。先に同じPDFを登録してから受け取ってください。</div>`));
        } else {
          const select = document.createElement("select");
          choices.forEach((item, index) => {
            const option = document.createElement("option");
            option.value = String(index);
            option.textContent = `\${exact.includes(item) ? "一致" : "参考候補"}：\${item.title}（\${item.grade}・\${item.subject}）`;
            select.append(option);
          });
          const apply = el(`<button class="ps-share-primary ps-share-apply">選んだ教材に栞を適用</button>`);
          apply.onclick = async () => {
            const target = choices[Number(select.value)];
            const next = {
              ...target,
              segments: pack.material.segments || [],
              answerSegments: pack.material.answerSegments || [],
              toc: pack.material.toc || target.toc,
              updatedAt: now(),
              bookmarkImportedAt: now(),
              bookmarkSharedAt: pack.createdAt
            };
            await putMaterial(next);
            alert(`「\${target.title}」に共有栞を適用しました。画面を更新して確認してください。`);
            close();
          };
          panel.append(el(`<p>\${exact.length ? "一致した教材が見つかりました。" : "同名教材を参考候補として表示しています。ページ範囲を確認してから適用してください。"}</p>`), select, apply);
        }
        content.replaceWith(panel);
      } catch (error) {
        alert(error.message || "受け取れませんでした");
        button.disabled = false; button.textContent = "コードを確認";
      }
    };
    modal(content);
  }
  function inject() {
    const target = document.querySelector(".workspace-setting") || document.querySelector(".backup-setting");
    if (!target || document.querySelector(".ps-share-section")) return;
    const section = el(`<section class="panel setting ps-share-section"><span class="round cyan">↗</span><div><h2>共有しおり</h2><p>PDFを送らずに、教材の単元分け・目次・解答対応だけをコードでやり取りします。</p><div class="ps-share-actions"><button type="button">栞を送る</button><button type="button">栞を受け取る</button></div></div></section>`);
    const [send, receive] = section.querySelectorAll("button");
    send.onclick = shareDialog;
    receive.onclick = receiveDialog;
    target.parentElement.insertBefore(section, target);
  }
  new MutationObserver(inject).observe(document.documentElement, { childList: true, subtree: true });
  inject();
})();
