import React, { useState, useRef, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'

/**
 * قائمة منسدلة مع بحث وفلترة - لتسهيل البحث عن العناصر
 * @param {Object} props
 * @param {Array} props.options - مصفوفة الخيارات [{value, label}, ...] أو مصفوفة كائنات
 * @param {string} props.value - القيمة المختارة
 * @param {function} props.onChange - (value) => void
 * @param {string} props.placeholder - نص placeholder
 * @param {string} props.searchPlaceholder - placeholder حقل البحث
 * @param {string} props.className - كلاسات إضافية
 * @param {string} props.optionLabelKey - مفتاح النص في الخيار (إذا options مصفوفة كائنات)
 * @param {string} props.optionValueKey - مفتاح القيمة في الخيار
 * @param {boolean} props.disabled
 * @param {boolean} props.required
 */
function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'اختر...',
  searchPlaceholder = 'بحث...',
  className = '',
  optionLabelKey = 'label',
  optionValueKey = 'value',
  optionSearchKeys = null,
  disabled = false,
  required = false,
  renderOption,
}) {
  const { theme } = useTheme()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const optionRefs = useRef([])

  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      return {
        value: opt[optionValueKey] ?? opt.id ?? opt.value,
        label: opt[optionLabelKey] ?? opt.name ?? opt.label ?? String(opt[optionValueKey] ?? opt.id ?? ''),
        raw: opt,
      }
    }
    return { value: opt, label: String(opt), raw: opt }
  })

  const searchLower = search.trim().toLowerCase()
  const filteredOptions = searchLower
    ? normalizedOptions.filter((o) => {
        if (String(o.label || '').toLowerCase().includes(searchLower)) return true
        if (optionSearchKeys && Array.isArray(optionSearchKeys) && o.raw && typeof o.raw === 'object') {
          return optionSearchKeys.some((key) =>
            String(o.raw[key] ?? '').toLowerCase().includes(searchLower)
          )
        }
        return false
      })
    : normalizedOptions

  const selectedLabel = normalizedOptions.find((o) => String(o.value) === String(value))?.label ?? value ?? ''

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!open) {
      setHighlightIndex(-1)
      return
    }
    // عند فتح القائمة أو تغيير الفلتر، نرجّع المؤشر للبداية
    setHighlightIndex(filteredOptions.length > 0 ? 0 : -1)
    optionRefs.current = []
  }, [open, searchLower, filteredOptions.length])

  useEffect(() => {
    if (highlightIndex >= 0 && optionRefs.current[highlightIndex]) {
      optionRefs.current[highlightIndex].scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex])

  const baseInputClass = `w-full px-3 py-2 rounded text-right ${
    theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'
  } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${baseInputClass} flex items-center justify-between min-h-[42px]`}
        disabled={disabled}
      >
        <span className={!selectedLabel ? 'opacity-60' : ''}>
          {selectedLabel || placeholder}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-50 w-full mt-1 rounded-lg shadow-lg border max-h-60 overflow-hidden ${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'
          }`}
        >
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (!filteredOptions.length) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setHighlightIndex((prev) => {
                    const next = prev < filteredOptions.length - 1 ? prev + 1 : 0
                    return next
                  })
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setHighlightIndex((prev) => {
                    const next = prev > 0 ? prev - 1 : filteredOptions.length - 1
                    return next
                  })
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (highlightIndex >= 0 && filteredOptions[highlightIndex]) {
                    const opt = filteredOptions[highlightIndex]
                    onChange(opt.value)
                    setOpen(false)
                    setSearch('')
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setOpen(false)
                }
              }}
              className={`w-full px-3 py-2 rounded text-right text-sm ${
                theme === 'dark' ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100 text-gray-900 placeholder-gray-500'
              }`}
              autoFocus
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filteredOptions.length === 0 ? (
              <div className={`px-3 py-4 text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                لا توجد نتائج
              </div>
            ) : (
              filteredOptions.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  ref={(el) => {
                    optionRefs.current[idx] = el
                  }}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                    setSearch('')
                  }}
                  className={`w-full text-right px-3 py-2 text-sm hover:bg-opacity-80 transition ${
                    idx === highlightIndex
                      ? theme === 'dark'
                        ? 'bg-camel/40 text-camel'
                        : 'bg-brown/20 text-brown'
                      : String(opt.value) === String(value)
                      ? theme === 'dark'
                        ? 'bg-camel/30 text-camel'
                        : 'bg-brown/20 text-brown'
                      : theme === 'dark'
                      ? 'hover:bg-gray-700 text-gray-200'
                      : 'hover:bg-gray-100 text-gray-800'
                  }`}
                >
                  {renderOption ? renderOption(opt.raw, opt) : opt.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {required && !value && (
        <input
          tabIndex={-1}
          required
          className="absolute opacity-0 pointer-events-none h-0 w-0"
          onChange={() => {}}
          value=""
        />
      )}
    </div>
  )
}

export default SearchableSelect
