import { useState } from "react";
import {
  useLocalStorage,
  STORAGE_KEYS,
  makeId,
} from "./storage.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

export default function CustomersScreen({ back }) {
  const [customers, setCustomers] = useLocalStorage(STORAGE_KEYS.customers, []);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  /** @type {[null | {id:string,name:string}, Function]} */
  const [confirmDelete, setConfirmDelete] = useState(null);

  const trimmedNew = newName.trim();
  const duplicateNew = trimmedNew.length > 0 &&
    customers.some((c) => c.name === trimmedNew);

  function add() {
    if (!trimmedNew || duplicateNew) return;
    setCustomers([...customers, { id: makeId("cust"), name: trimmedNew }]);
    setNewName("");
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditingName(c.name);
  }

  function saveEdit() {
    const name = editingName.trim();
    if (!name) return;
    setCustomers(
      customers.map((c) => (c.id === editingId ? { ...c, name } : c)),
    );
    setEditingId(null);
    setEditingName("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  function doDelete(customer) {
    setCustomers(customers.filter((c) => c.id !== customer.id));
    setConfirmDelete(null);
  }

  return (
    <div className="app">
      <header className="screen-header">
        <button className="back" onClick={back}>← 戻る</button>
        <h1>ユーザー管理</h1>
        <p className="meta">{customers.length} 名</p>
      </header>

      <main>
        <section className="card">
          <h2>新規追加</h2>
          <div className="row-input">
            <input
              type="text"
              placeholder="ユーザー名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              maxLength={32}
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
            <p className="error">同じ名前のユーザーが既に登録されています</p>
          )}
        </section>

        <section className="card">
          <h2>登録済みユーザー</h2>
          {customers.length === 0 ? (
            <p className="empty">未登録です</p>
          ) : (
            <ul className="entry-list">
              {customers.map((c) => (
                <li key={c.id}>
                  {editingId === c.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        maxLength={32}
                        autoFocus
                      />
                      <button className="primary" onClick={saveEdit}>
                        保存
                      </button>
                      <button onClick={cancelEdit}>キャンセル</button>
                    </>
                  ) : (
                    <>
                      <span className="entry-name">{c.name}</span>
                      <button onClick={() => startEdit(c)}>編集</button>
                      <button
                        className="danger-outline"
                        onClick={() => setConfirmDelete(c)}
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
