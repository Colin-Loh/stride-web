import { formatDurationSeconds, parseDuration } from '../plan/convert'
import { TimeTextInput, type TimeInputProps } from './TimeTextInput'
export function DurationInput(props: TimeInputProps) {
  return <TimeTextInput {...props} parse={parseDuration} format={formatDurationSeconds} placeholder="m:ss or h:mm:ss"
    error="Enter a time as m:ss or h:mm:ss, for example 27:30 or 1:58:00." />
}
