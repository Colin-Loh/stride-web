import { formatPaceSeconds, parsePace } from '../plan/convert'
import { TimeTextInput, type TimeInputProps } from './TimeTextInput'
export function PaceInput(props: TimeInputProps) {
  return <TimeTextInput {...props} parse={parsePace} format={formatPaceSeconds} placeholder="m:ss"
    error="Enter a positive pace as m:ss, with seconds from 00 to 59." />
}
