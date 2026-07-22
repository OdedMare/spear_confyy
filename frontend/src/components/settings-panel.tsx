"use client";

import { Database, GitBranch, LoaderCircle, RefreshCw, Save, ShieldCheck, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type AppSettings = {
  llm_model: string;
  llm_diet_mode: boolean;
  llm_base_url: string | null;
  openai_api_key_set: boolean;
  openai_api_key_hint: string | null;
  database_url: string;
  gitlab_url: string | null;
  gitlab_token_set: boolean;
  gitlab_token_hint: string | null;
  gitlab_verify_tls: boolean;
};

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [saved, setSaved] = useState<AppSettings | null>(null);
  const [model, setModel] = useState("");
  const [dietMode, setDietMode] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [gitlabUrl, setGitlabUrl] = useState("");
  const [gitlabToken, setGitlabToken] = useState("");
  const [verifyTls, setVerifyTls] = useState(true);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("טעינת ההגדרות נכשלה");
        return (await response.json()) as AppSettings;
      })
      .then((data) => {
        if (!active) return;
        setSaved(data);
        setModel(data.llm_model);
        setDietMode(data.llm_diet_mode);
        setBaseUrl(data.llm_base_url ?? "");
        setApiKey("");
        setDatabaseUrl(data.database_url);
        setGitlabUrl(data.gitlab_url ?? "");
        setGitlabToken("");
        setVerifyTls(data.gitlab_verify_tls);
        setError("");
        setNotice("");
      })
      .catch((requestError: Error) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [open]);

  async function probeModels() {
    setProbing(true);
    setError("");
    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llm_base_url: baseUrl.trim() || null, openai_api_key: apiKey.trim() || null }),
      });
      const body = (await response.json().catch(() => null)) as { models?: string[]; detail?: string } | null;
      if (!response.ok) throw new Error(body?.detail || "טעינת המודלים נכשלה");
      setModels(body?.models ?? []);
      setNotice(`נמצאו ${body?.models?.length ?? 0} מודלים זמינים`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "טעינת המודלים נכשלה");
    } finally {
      setProbing(false);
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    const update: Record<string, unknown> = {
      llm_model: model.trim(),
      llm_diet_mode: dietMode,
      llm_base_url: baseUrl.trim() || null,
      openai_api_key: apiKey,
      gitlab_url: gitlabUrl.trim() || null,
      gitlab_token: gitlabToken,
      gitlab_verify_tls: verifyTls,
    };
    if (databaseUrl !== saved.database_url) update.database_url = databaseUrl.trim();
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const body = (await response.json().catch(() => null)) as AppSettings & { detail?: string };
      if (!response.ok) throw new Error(body?.detail || "שמירת ההגדרות נכשלה");
      setSaved(body);
      setApiKey("");
      setGitlabToken("");
      setDatabaseUrl(body.database_url);
      setNotice("ההגדרות נשמרו ונכנסו לתוקף מיד.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "שמירת ההגדרות נכשלה");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div className="modal-scrim" role="presentation">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header><div><span className="section-kicker">Runtime configuration</span><h2 id="settings-title">הגדרות Spear</h2><p>אותו מנגנון runtime של locatoAi — השינויים נשמרים ומופעלים בלי build חדש.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="סגירת הגדרות"><X size={19} /></button></header>
        {loading ? <div className="settings-loading"><LoaderCircle className="spin" size={22} /> טוענים הגדרות...</div> : (
          <form onSubmit={saveSettings}>
            {error && <div className="system-banner error" role="alert">{error}</div>}
            {notice && <div className="system-banner success" role="status">{notice}</div>}

            <fieldset><legend><Sparkles size={17} /> LLM — OpenAI compatible</legend>
              <label>Base URL<input dir="ltr" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="http://server:11434/v1" /></label>
              <label>API key {saved?.openai_api_key_set && <small>נשמר {saved.openai_api_key_hint}</small>}<input dir="ltr" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={saved?.openai_api_key_set ? "ריק = שמירת המפתח הקיים" : "אופציונלי לשרת מקומי"} autoComplete="new-password" /></label>
              <div className="model-field"><label>Model<input dir="ltr" value={model} onChange={(event) => setModel(event.target.value)} list="spear-models" required /></label><button className="secondary-button" type="button" onClick={probeModels} disabled={probing}>{probing ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />} רענון מודלים</button></div>
              <datalist id="spear-models">{models.map((item) => <option value={item} key={item} />)}</datalist>
              <label className="check-row"><input type="checkbox" checked={dietMode} onChange={(event) => setDietMode(event.target.checked)} /> Diet mode — prompts ותשובות מוגבלים</label>
            </fieldset>

            <fieldset><legend><Database size={17} /> PostgreSQL</legend>
              <label>Database URL<input dir="ltr" value={databaseUrl} onChange={(event) => setDatabaseUrl(event.target.value)} placeholder="postgresql://user:password@host:5432/spear" /></label>
              <p className="field-help">אם מוצג <span dir="ltr">****</span>, השאירו ללא שינוי או הזינו URL מלא חדש.</p>
            </fieldset>

            <fieldset><legend><GitBranch size={17} /> GitLab</legend>
              <label>GitLab URL<input dir="ltr" value={gitlabUrl} onChange={(event) => setGitlabUrl(event.target.value)} placeholder="https://gitlab.internal" /></label>
              <label>Access token {saved?.gitlab_token_set && <small>נשמר {saved.gitlab_token_hint}</small>}<input dir="ltr" type="password" value={gitlabToken} onChange={(event) => setGitlabToken(event.target.value)} placeholder={saved?.gitlab_token_set ? "ריק = שמירת ה-token הקיים" : "glpat-..."} autoComplete="new-password" /></label>
              <label className="check-row"><input type="checkbox" checked={verifyTls} onChange={(event) => setVerifyTls(event.target.checked)} /><ShieldCheck size={15} /> אימות TLS</label>
            </fieldset>

            <footer><button className="secondary-button" type="button" onClick={onClose}>ביטול</button><button className="primary-button" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />} שמירת הגדרות</button></footer>
          </form>
        )}
      </section>
    </div>
  );
}
