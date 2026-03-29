import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Box, Typography } from "@mui/material";

interface Props {
  content: string;
}

export default function MarkdownContent({ content }: Props) {
  return (
    <Box
      sx={{
        "& > *:first-of-type": { mt: 0 },
        "& > *:last-child": { mb: 0 },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.65 }}>
              {children}
            </Typography>
          ),

          h1: ({ children }) => (
            <Typography variant="h6" fontWeight={700} sx={{ mt: 1.5, mb: 0.5 }}>
              {children}
            </Typography>
          ),
          h2: ({ children }) => (
            <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1.5, mb: 0.5 }}>
              {children}
            </Typography>
          ),
          h3: ({ children }) => (
            <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1, mb: 0.5 }}>
              {children}
            </Typography>
          ),

          ul: ({ children }) => (
            <Box component="ul" sx={{ pl: 2.5, mb: 1, mt: 0 }}>
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box component="ol" sx={{ pl: 2.5, mb: 1, mt: 0 }}>
              {children}
            </Box>
          ),
          li: ({ children }) => (
            <Typography component="li" variant="body2" sx={{ mb: 0.25, lineHeight: 1.65 }}>
              {children}
            </Typography>
          ),

          blockquote: ({ children }) => (
            <Box
              component="blockquote"
              sx={{
                borderLeft: "3px solid",
                borderColor: "divider",
                pl: 1.5,
                ml: 0,
                my: 1,
                color: "text.secondary",
              }}
            >
              {children}
            </Box>
          ),

          code: ({ className, children }) => {
            const language = /language-(\w+)/.exec(className || "")?.[1];
            // Block code: has a language class or is multiline
            const isBlock = Boolean(language) || String(children).includes("\n");

            if (isBlock) {
              return (
                <Box sx={{ my: 1, borderRadius: 1, overflow: "hidden", fontSize: 13 }}>
                  <SyntaxHighlighter
                    language={language ?? "text"}
                    style={vscDarkPlus}
                    customStyle={{ margin: 0, borderRadius: 4 }}
                  >
                    {String(children).replace(/\n$/, "")}
                  </SyntaxHighlighter>
                </Box>
              );
            }

            return (
              <Box
                component="code"
                sx={{
                  bgcolor: "action.selected",
                  px: 0.6,
                  py: 0.2,
                  borderRadius: 0.5,
                  fontFamily: "monospace",
                  fontSize: "0.85em",
                }}
              >
                {children}
              </Box>
            );
          },

          // Suppress the <pre> wrapper — SyntaxHighlighter handles its own container
          pre: ({ children }) => <>{children}</>,

          strong: ({ children }) => (
            <Box component="strong" sx={{ fontWeight: 700 }}>
              {children}
            </Box>
          ),

          em: ({ children }) => (
            <Box component="em" sx={{ fontStyle: "italic" }}>
              {children}
            </Box>
          ),

          a: ({ href, children }) => (
            <Box
              component="a"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "primary.main", textDecoration: "underline" }}
            >
              {children}
            </Box>
          ),

          hr: () => <Box component="hr" sx={{ my: 1.5, border: "none", borderTop: "1px solid", borderColor: "divider" }} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
