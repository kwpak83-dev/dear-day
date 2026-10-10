"use client";
import { useState } from "react";
import { BANK_OPTIONS } from "../lib/bank-options";

export default function BankSelector({ value, onChange }) {
  const isPresetBank = BANK_OPTIONS.some((bank) => bank.name === value);
  const [open, setOpen] = useState(false);
  const [directMode, setDirectMode] = useState(
    Boolean(value) && !isPresetBank
  );

  const selectBank = (bankName) => {
    onChange(bankName);
    setDirectMode(false);
    setOpen(false);
  };

  return (
    <div className="bank-selector">
      <button
        type="button"
        className="bank-select-trigger"
        onClick={() => setOpen(true)}
      >
        <span>{value || "은행을 선택하세요"}</span>
        <span className="bank-select-arrow">선택 ›</span>
      </button>

      {open && (
        <div
          className="bank-sheet-overlay"
          onClick={() => setOpen(false)}
        >
          <div
            className="bank-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="은행 선택"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bank-sheet-header">
              <strong>은행 선택</strong>

              <button
                type="button"
                className="bank-sheet-close"
                onClick={() => setOpen(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="bank-grid">
              {BANK_OPTIONS.map((bank) => (
                <button
                  key={bank.name}
                  type="button"
                  className={`bank-option ${
                    value === bank.name ? "selected" : ""
                  }`}
                  onClick={() => selectBank(bank.name)}
                >
                  <img src={bank.logo} alt="" />
                  <span>{bank.name}</span>
                </button>
              ))}
            </div>

            {directMode ? (
              <div className="bank-direct-area">
                <input
                  type="text"
                  className="bank-direct-input"
                  placeholder="은행명을 직접 입력하세요"
                  value={isPresetBank ? "" : value}
                  onChange={(e) => onChange(e.target.value)}
                  autoFocus
                />

                <button
                  type="button"
                  className="bank-direct-confirm"
                  onClick={() => setOpen(false)}
                  disabled={!value.trim()}
                >
                  확인
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="bank-direct-button"
                onClick={() => {
                  onChange("");
                  setDirectMode(true);
                }}
              >
                직접입력
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
