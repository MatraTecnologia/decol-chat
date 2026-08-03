'use client'

import { CalendarRange } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@workspace/ui/components/button'
import { Calendar } from '@workspace/ui/components/calendar'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@workspace/ui/components/popover'

import {
  formatRangeLabel,
  matchPreset,
  normalizeRange,
  parseDayKey,
  PERIOD_PRESETS,
  presetRange,
  toDayKey,
  type DayRange,
} from './period-range'

interface PeriodFilterProps {
  range: DayRange | null
  today: Date | null
  onChange: (range: DayRange) => void
}

export const PeriodFilter = ({ range, today, onChange }: PeriodFilterProps) => {
  const [open, setOpen] = useState(false)

  const activePreset = range && today ? matchPreset(range, today) : null
  const isCustom = !!range && !activePreset

  const selected = {
    from: parseDayKey(range?.from) ?? undefined,
    to: parseDayKey(range?.to) ?? undefined,
  }

  const handleSelect = (next: { from?: Date; to?: Date } | undefined) => {
    if (!next?.from) return

    const from = toDayKey(next.from)

    onChange(normalizeRange(from, next.to ? toDayKey(next.to) : from))

    if (next.to) setOpen(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PERIOD_PRESETS.map(preset => (
        <Button
          key={preset.value}
          size="sm"
          variant={activePreset === preset.value ? 'default' : 'outline'}
          disabled={!today}
          onClick={() => today && onChange(presetRange(preset.value, today))}
        >
          {preset.label}
        </Button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={isCustom ? 'default' : 'outline'}
            disabled={!range}
          >
            <CalendarRange className="size-4" />
            {isCustom && range ? formatRangeLabel(range) : 'Personalizado'}
          </Button>
        </PopoverTrigger>

        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            autoFocus
            numberOfMonths={1}
            defaultMonth={selected.from}
            selected={selected}
            onSelect={handleSelect}
            disabled={today ? { after: today } : undefined}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
