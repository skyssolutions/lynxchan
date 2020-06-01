find . -path ./node_modules -prune -o -path ./addons -prune -o -name '*.js' | xargs wc -l
