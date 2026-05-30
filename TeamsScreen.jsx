import { useState } from "react";
import {
  useLocalStorage,
  STORAGE_KEYS,
  makeId,
} from "./storage.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

/**
 * Per the v2 spec, teams hold only a name. Handicap is per-game (set in
 * the Stage 3 daily input screen), so this screen is intentionally
 * symmetric with CustomersScreen — the two could share an "EntityCRUD"
 * component, but at 2 instances the duplication is cheaper than the
 * abstraction.
 */
export default function TeamsScreen({ back }) {
  const [teams, setTeams] = useLocalStorage(STORAGE_KEYS.teams, []);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  /** @type {[null | {id:string,name:string}, Function]} */
  const [confirmDelete, setConfirmDelete] = useState(null);

  const trimmedNew = newName.trim();
  const duplicateNew = trimmedNew.length > 0 &&
    teams.some((t) => t.name === trimmedNew);

  function add() {
    if (!trimmedNew || duplicateNew) return;
    setTeams([...teams, { id: makeId("team"), name: trimmedNew }]);
    setNewName("");
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditingName(t.name);
  }

  function saveEdit() {
    const name = editingName.trim();
    if (!name) return;
    setTeams(teams.map((t) => (t.id === editingId ? { ...t, name } : t)));
    setEditingId(null);
    setEditingName("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  function doDelete(team) {
    setTeams(teams.filter((t) => t.id !== team.id));
    setConfirmDelete(null);
  }

  return (
    <div className="app">
      <header className="screen-header">
        <button className="back" onClick={back}>← 戻る</button>
        <h1>チーム管理</h1>
        <p className="meta">{teams.length} チーム</p>
      </header>

      <main>
        <section className="card">
          <h2>新規追加</h2>
          <div className="row-input">
            <input
              type="text"
              placeholder="チーム名（巨人 / 阪神 等）"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              maxLength={24}
            />
            <button
              className="primary"
              onClick={add}
              disabled={!trimmedNew || duplicateNew}
            >
              追加
            </button>
          </div>
          {duplicateNew && (
            <p className="error">同じ名前のチームが既に登録されています</p>
          )}
        </section>

        <section className="card">
          <h2>登録済みチーム</h2>
          {teams.length === 0 ? (
            <p className="empty">未登録です</p>
          ) : (
            <ul className="entry-list">
              {teams.map((t) => (
                <li key={t.id}>
                  {editingId === t.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        maxLength={24}
                        autoFocus
                      />
                      <button className="primary" onClick={saveEdit}>
                        保存
                      </button>
                      <button onClick={cancelEdit}>キャンセル</button>
                    </>
                  ) : (
                    <>
                      <span className="entry-name">{t.name}</span>
                      <button onClick={() => startEdit(t)}>編集</button>
                      <button
                        className="danger-outline"
                        onClick={() => setConfirmDelete(t)}
                      >
                        削除
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="hint">
          ※ ハンデは試合ごとに日別入力画面で設定します（Stage 3）
        </p>
      </main>

      {confirmDelete && (
        <ConfirmDialog
          message={`「${confirmDelete.name}」を削除しますか？\n（過去の入力データは消えません）`}
          confirmLabel="削除する"
          onConfirm={() => doDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
