import fs from 'node:fs';
import path from 'node:path';
import type {
  RsbuildConfig,
  RsbuildPlugin,
  RsbuildPluginAPI,
} from '@rsbuild/core';
import { getExportDefaultFromAST } from './getDefault.js';

export type PluginOptions = {
  foo?: string;
  bar?: boolean;
};

export const plugin = (options: PluginOptions = {}): RsbuildPlugin => ({
  name: 'i18n-flow:rsbuild',

  setup(api: RsbuildPluginAPI) {
    api.modifyRsbuildConfig(
      (
        userConfig: RsbuildConfig,
        {
          mergeRsbuildConfig,
        }: {
          mergeRsbuildConfig: (
            a: RsbuildConfig,
            b: RsbuildConfig,
          ) => RsbuildConfig;
        },
      ) => {
        if (process.env.NODE_ENV !== 'development') {
          return userConfig;
        }

        const extraConfig: RsbuildConfig = {
          dev: {
            setupMiddlewares: [
              (middlewares, server) => {
                middlewares.unshift((req, res, next: () => void) => {
                  if (req.url === '/i18n-flow/update') {
                    let body = '';

                    req.on('data', (chunk: Buffer) => {
                      body += chunk.toString();
                    });

                    req.on('end', async () => {
                      try {
                        console.log('Received body:', body);
                        const target: {
                          key: string[];
                          en: string;
                          cn: string;
                          lang: 'en' | 'cn';
                        } = JSON.parse(body);
                        const rootPath = api.context.rootPath;
                        const langPath =
                          target.lang === 'cn' ? 'zh-CN' : 'en-US';
                        //TODO： 使用项目配置的 path
                        const dstFile = path.join(
                          rootPath,
                          `./src/lang/${langPath}/${target.key[1]}.ts`,
                        );

                        const oldDstMessages = getExportDefaultFromAST(dstFile);

                        const updatedMessages = {
                          ...oldDstMessages,
                          [target.key[2]]:
                            target.lang === 'cn' ? target.cn : target.en,
                        };
                        fs.writeFileSync(
                          dstFile,
                          `export default ${JSON.stringify(updatedMessages, null, 2)}`,
                        );
                        res.writeHead(200, {
                          'Content-Type': 'application/json',
                        });
                        res.end(JSON.stringify({ message: 'Received' }));
                      } catch (error) {
                        console.error('Error processing request:', error);
                        res.writeHead(500, {
                          'Content-Type': 'application/json',
                        });
                        res.end(
                          JSON.stringify({ message: 'Internal Server Error' }),
                        );
                      }
                    });
                  } else {
                    next();
                  }
                });
              },
            ],
          },
        };

        return mergeRsbuildConfig(userConfig, extraConfig);
      },
    );
  },
});
