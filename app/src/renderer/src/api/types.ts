/**
 * Friendly names for the engine's API types. Everything here is an alias of the generated
 * `schema.d.ts` (run `npm run gen:api` after engine API changes) — never hand-write API shapes.
 */
import type { Readable } from 'openapi-typescript-helpers'

import type { components } from './schema'

/**
 * Types as openapi-fetch returns them (`Readable<>` also turns tuples such as polygon points into
 * plain arrays), so values from responses can be sent straight back in requests.
 */
type Schemas = { [K in keyof components['schemas']]: Readable<components['schemas'][K]> }

// Library & videos
export type VideoSummary = Schemas['VideoSummary']
export type VideoStatus = VideoSummary['status']
export type Library = Schemas['Library']
export type FolderInfo = Schemas['FolderInfo']
export type RecentFolder = Schemas['RecentFolder-Output']
export type VideoInfo = Schemas['VideoInfo']

// Session & document
export type SessionState = Schemas['SessionState']
export type DocumentView = Schemas['DocumentView']
export type TrackSummary = Schemas['TrackSummary']

// Setup
export type Setup = Schemas['Setup']
export type Zone = Schemas['Zone']
export type RectShape = Schemas['RectShape']
export type EllipseShape = Schemas['EllipseShape']
export type PolygonShape = Schemas['PolygonShape']
export type Shape = RectShape | EllipseShape | PolygonShape
export type ImageAdjustments = Schemas['ImageAdjustments']
export type DetectionSettings = Schemas['DetectionSettings']
export type AnalysisSettings = Schemas['AnalysisSettings']
export type TrialWindow = Schemas['TrialWindow']
export type TemplateRef = Schemas['TemplateRef']
export type Calibration = Schemas['Calibration']
export type DetectionPreview = Schemas['DetectionPreviewResponse']
export type Observation = Schemas['ObservationView']

// Tracking, review & results
export type Track = Schemas['Track']
export type FrameStatus = Track['status'][number]
export type Flag = Schemas['Flag']
export type FlagView = Schemas['FlagView']
export type FlagStatus = FlagView['status']
export type FlagReason = Flag['reason']
export type SetPosition = Schemas['SetPosition-Output']
export type MarkHidden = Schemas['MarkHidden-Output']
export type Interpolate = Schemas['Interpolate-Output']
export type AcceptFlag = Schemas['AcceptFlag-Output']
export type Correction = SetPosition | MarkHidden | Interpolate | AcceptFlag
export type HistoryEntry = Schemas['HistoryEntry']
export type Results = Schemas['Results']
export type SummaryRow = Schemas['SummaryRow']
export type ZoneVisit = Schemas['ZoneVisit']

// Jobs, batches, templates, settings, system
export type Job = Schemas['Job']
export type JobState = Job['state']
export type Batch = Schemas['Batch']
export type BatchCheckItem = Schemas['BatchCheckItem']
export type BatchItemRequest = Schemas['BatchItemRequest']
export type Template = Schemas['Template-Output']
export type TemplateInput = Schemas['Template-Input']
export type AppSettings = Schemas['AppSettings-Output']
export type SystemInfo = Schemas['SystemInfo']
export type ExportFormat = Schemas['ExportRequest']['format']
