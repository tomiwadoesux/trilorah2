// The site reads the same map the app ships with, so the two never disagree.
import map from '../../../../docs/product-guide/product-map.json';

export type LessonPoint = { id: string; say: string[]; anchor: string; do: string };
export type GuideTask = {
  id: string; title: string; area: string; entry: string; status: string;
  asks?: string[]; lesson?: LessonPoint[]; near?: string[]; since?: string; consequential?: boolean;
};
const tasks = (map as { tasks: GuideTask[] }).tasks;
export const mapVersion = (map as { packageVersion: string }).packageVersion;
/** Only lessons the Messenger can actually walk through in the app. */
export const lessons: GuideTask[] = tasks.filter(task => task.lesson?.length && task.status === 'wired');
export const lessonById = (id: string) => lessons.find(task => task.id === id);
export const areaTitles: Record<string, string> = {
  audio: 'Hearing the preacher', output: 'The wall', scripture: 'Scripture', songs: 'Songs', media: 'Pictures and video',
  run: 'The service', 'service files': 'Service files', remote: 'Phones', companion: 'Phones',
};
/** Steps the volunteer presses themselves: anything that goes to the wall or approves a device. */
export const yours = (point: LessonPoint) => point.do === 'choose' || point.do === 'listen' || point.do === 'input';
