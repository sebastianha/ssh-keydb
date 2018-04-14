# ssh-keydb – A tool to gather ssh public key information from servers

ssh-keydb is a small tool which connects to a number of ssh servers and saves all available ssh public keys into a json file. This is useful to get an overview which public key is distributed on which server.

# Usage

```
Usage: ssh-keydb [options]

  Options:

    -V, --version             output the version number
    -r, --range <ip/netmask>  (required) IP Range to test
    -p, --parallel <number>   (optional) Run <number> tests in parallel, default is "1"
    -f, --file <file name>    (optional) File name for key db, default is keydb.json
    -u, --user <user name>    (optional) User name for log in, default is "root"
    -t, --timeout <ms>        (optional) Timeout for handshake in ms, default is "20000"
    -h, --help                output usage information
```

Example:

```
# Test one host
./ssh-keydb.js -r 192.168.232.0/32

# Test 192.168.232.0 - 192.168.232.255
./ssh-keydb.js -r 192.168.232.0/24

# Run 100 ssh connections parallel
./ssh-keydb.js -r 192.168.232.0/24 -p 100

# Reduce timeout for faster testing
./ssh-keydb.js -r 192.168.232.0/24 -p 100 -t 5000
```

# Results

The result is a JSON file in the following format:

```
{
"AAAAABBBBBCCCCC(ssh public key)": {
    "type": "ssh-rsa",
    "comment": "user@machine",
    "servers": [
      "192.168.232.1",
      "192.168.232.2",
      "192.168.232.29",
      ...
    ]
  },
  ...
}
```

# Hints

Use jq to format and filter results

```
# Pretty print keydb
cat keydb.json  | jq '.'

# Show number of servers per key and sort
cat keydb.json  | jq '.[] | {name: .comment, servers: .servers|length}' | jq --slurp '.|sort_by(.servers)|reverse'
```

# License

MIT license, have fun!
