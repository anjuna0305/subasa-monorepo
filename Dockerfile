FROM fedora:latest

RUN dnf upgrade -y
RUN dnf install -y neovim git zsh && dnf clean all

WORKDIR /root
CMD ["zsh"]
