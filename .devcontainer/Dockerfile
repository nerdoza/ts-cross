FROM node:12
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get -y install --no-install-recommends apt-utils dialog 2>&1 \ 
    && apt-get -y install git iproute2 procps vim less\
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

RUN wget -O ~/posh-git.sh "https://raw.githubusercontent.com/lyze/posh-git-sh/master/git-prompt.sh" \
    && echo "source ~/posh-git.sh" >> ~/.bashrc \
    && echo "PROMPT_COMMAND='__posh_git_ps1 \"\[\e[0;33m\]\w \" \"\[\e[1;34m\]\n\\\$\[\e[0m\] \";'\$PROMPT_COMMAND" >> ~/.bashrc

ENV DEBIAN_FRONTEND=dialog
