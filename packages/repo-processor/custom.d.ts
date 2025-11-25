declare module 'remark-wiki-link-plus';

declare module '@wordpress/wordcount' {
  export function count(text: string, type: 'words' | 'characters' | 'characters_excluding_spaces', options?: object): number;
}